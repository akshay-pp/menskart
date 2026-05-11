import {Cart} from "../models/cart.model.js";
import {Address} from "../models/address.model.js";
import {User} from "../models/user.model.js";
import {Coupon} from "../models/coupon.model.js";
import {Product} from "../models/product.model.js";
import {Order} from "../models/order.model.js";
import {findBestPrice} from "../utils/calculateOfferPrice.js";
import {razorpay, verifySign} from "../utils/razorpay.js";
import {generateInvoiceNumber, generateOrderId, generateCheckoutSessionId} from "../utils/idGenerator.js";
import { STATUS_CODES } from "../utils/constants/statusCodes.js";
import { Types } from "mongoose";
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import {fileURLToPath} from 'url';



//------------------- order operations -------------------------//


// get checkout page

export const getCheckout = async(req,res) => {

    let cart, address, user, wallet;
    try {
        [cart, address, user, wallet] = await Promise.all([
            Cart.findOne({owner: req.session.user._id}).populate('items.product', 'productname price images'),
            Address.find({owner: req.session.user._id}),
            User.findById(req.session.user._id, {couponsUsed: 1, _id: 0}),
            Wallet.findOne({owner: req.session.user._id}, {balance: 1, _id: 0})
        ]);

        if(!cart) {
            return res.status(STATUS_CODES.NOT_FOUND).json({success: false, error: "Cart not found."});
        }

        if(!user) {
            return res.status(STATUS_CODES.NOT_FOUND).json({success: false, error: "User not found."});
        }

    } catch (err) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: "Database error", err});
    }
    

    if (!cart.items.length) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: 'Nothing to checkout… not even good intentions!'});
    } else {

        cart.items.forEach(item => {
            if(item.quantity > item.product.maxQuantity){
                return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `maximum quantity for ${item.product.productname} is ${item.product.maxQuantity}`})
            }
            if (item.product.stock < item.quantity ){
                return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `not enough stock for ${item.product.productname}`});
            }
        })

    }

    const cartWithOffersApplied = await applyOfferPricesToCart(cart);
    console.log(cartWithOffersApplied);
    
    const couponsUsed = user.couponsUsed.map(item => item.coupon);
    const coupons = await Coupon.find(
        {
            $and: [
                {couponActive: true},
                {validFrom: {$lte: new Date()}},
                {expiry: {$gte: new Date()}},
                {$expr: {$lt: ['$usage', '$maxUsage']}},
                {minimumCartValue: {$lte: cartWithOffersApplied.totalPrice}}
            ] 
        },
        
        {
            code: 1, description: 1, isPercent: 1, couponAmount: 1, maxDiscount: 1, expiry: 1
        }
    ).sort({createdAt: -1}).lean();

    const usableCoupons = coupons.filter(coupon => !couponsUsed.includes(coupon.code));

    usableCoupons.forEach(coupon => {
        
        let discount;
        if (coupon.isPercent) {
            let percentDiscount = cartWithOffersApplied.totalPrice*(coupon.couponAmount/100);
            discount = percentDiscount > coupon.maxDiscount ?  coupon.maxDiscount : percentDiscount;
        } else {
            discount = coupon.couponAmount;
        }
        coupon.discount = discount;

    });

    const disabledPaymentMethods = [];
    if (cartWithOffersApplied.totalPrice > 1000){
        disabledPaymentMethods.push('cod');
    }

    if (cartWithOffersApplied.totalPrice > wallet.balance) {
        disabledPaymentMethods.push('wallet');
    }

    let couponInfo = req.session.couponInfo || null;
    res.render("checkout", {cart: cartWithOffersApplied, address, couponInfo, coupons, usableCoupons, couponsUsed, walletBalance: wallet.balance, disabledPaymentMethods});

};



export const createOrder = async(req, res) => {

    const {address, paymentMethod} = req.body;
    
    if (!address){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Choose an address to proceed"});
    };

    if(!paymentMethod){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, message: "Choose a payment method to proceed"});
    };



    try {

        const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product');
        if(!cart) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({status: false, error: "No cart found for the user"});
        };

        const errors = [];
        
        //validations
        if (!cart.items.length){
            errors.push("Empty cart");
        };

        cart.items.forEach(item => {
            if(item.quantity > item.product.maxQuantity){
                errors.push(`maximum quantity for ${item.product.productname} is ${item.product.maxQuantity}`)
            }
    
            if (item.product.stock < item.quantity ){
                errors.push(`not enough stock for ${item.product.productname}`);
            }
        });

        console.log("validations check ✅");
        
        if (errors.length) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: errors});
        };

        
        const cartWithOffersApplied = await applyOfferPricesToCart(cart);
        let updatedCart = {...cartWithOffersApplied};
        console.log(updatedCart);

        
        if (req.body.coupon) {
            const cartWithCouponApplied = await applyCouponToCart(req.body.coupon, cartWithOffersApplied, req.session.user._id);
            updatedCart = {...cartWithCouponApplied};

            req.session.couponInfo = req.body.coupon;
            // console.log(updatedCart);
        };

        
        const priceBreakdown = pricingBreakdown(updatedCart);
        // console.log(priceBreakdown);

        const newOrder = new Order({
            owner : req.session.user._id,
            orderId: generateOrderId(),
            orderItems : updatedCart.items.map(item => {
                return {
                    product: item.product._id,
                    price: item.price,
                    offerInfo: item.offerInfo || null,
                    quantity: item.quantity,
                    subtotal: item.subtotal,
                    couponInfo: item.couponInfo || null,
                    finalPrice: item.finalPrice,
                    trackRecords: [
                        {status: "created", date: new Date()}
                    ]
                }
            }),
            totalPrice: priceBreakdown.grandTotal,
            pricing: {...priceBreakdown},
            paymentInfo: {
                status : "pending",
                mode : paymentMethod
            },
            address : address,
            couponInfo: updatedCart.couponInfo || null
        });
        console.log("new order object creation check ✅", newOrder);
        
        // if cod, create order
        // try integrating captcha verification for cod order
        let orderConfirm = false, responseJson;
        if(paymentMethod == "cash-on-delivery"){
            
            if (newOrder.totalPrice > 1000) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "COD is not allowed for orders above ₹1000"});
            };

            newOrder.orderStatus = "confirmed";
            newOrder.orderItems.forEach(item => item.status = "confirmed");
            await newOrder.save();
            orderConfirm = true;
            responseJson = {
                success: true,
                redirectUrl: `/api/user/order-confirmation?orderId=${newOrder._id}`
            }
            console.log({newOrder});

        } else if (paymentMethod == "razorpay"){

            await newOrder.save();
            req.session.tempOrderId = newOrder._id;
            const razorpayOrder  = await razorpay.orders.create({
                amount: newOrder.pricing.grandTotal*100,
                currency: "INR",
                receipt: `receipt#${newOrder.orderId}`,
                payment_capture: 1
            })

            console.log({razorpayOrder});
            responseJson = {
                success: true,
                razorpayOrder,
                prefill: {
                    name: req.session.user.fullname,
                    email: req.session.user.email,
                    contact: req.session.user.phone
                },
                key: process.env.RAZORPAY_KEY_ID
            };

        } else if (paymentMethod == "wallet") {
            
            try {
                const wallet = await Wallet.findOne({owner: req.session.user._id});
                if (wallet.balance < newOrder.totalPrice) {
                    return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Insufficient balance in the wallet"});
                };

                newOrder.orderStatus = "confirmed";
                newOrder.orderItems.forEach(item => item.status = "confirmed");
                newOrder.paymentInfo.status = "completed";
                await newOrder.save();
                orderConfirm = true;
                responseJson = {
                    success: true,
                    redirectUrl: `/api/user/order-confirmation?orderId=${newOrder._id}`
                }
                console.log({newOrder});

                const newTransaction = {
                    amount: newOrder.totalPrice,
                    direction: 'Debit',
                    source: 'paid-for-order',
                    relatedOrder: {
                        orderId: newOrder._id,
                        itemId: newOrder.orderItems[0]._id
                    },
                    status: 'success'
                };

                wallet.balance -= newOrder.totalPrice;
                wallet.transactions.push(newTransaction);
                await wallet.save();


            } catch (err) {
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
            }
        }
        //paypal if possible
        

        //post- order tasks
        if(orderConfirm === true){

            //update product quantity
            for (const item of cart.items) {

                const product = await Product.findById(item.product._id); 
                product.stock -= item.quantity;
                await product.save();

            }

            console.log("stock updation check ✅");


            //empty cart
            cart.items = [];
            await cart.save();
            console.log("cart emptied check ✅")



            //update coupon info - update coupon used by user and increment coupon usage
            if (newOrder.couponInfo) {

                let couponUsed = {
                    couponId: newOrder.couponInfo.couponId,
                    coupon: newOrder.couponInfo.couponCode
                };

                await User.findByIdAndUpdate(
                    req.session.user._id,
                    {$addToSet: {couponsUsed: couponUsed}}
                );

                await Coupon.findByIdAndUpdate(
                    newOrder.couponInfo.couponId, 
                    {$inc: {usage: 1}}
                );

            }

            console.log("coupon info updated on user side check ✅")


            //send order confirmation email
            await sendOrderConfirmation(req.session.user.email, newOrder);
            console.log("email sent check ✅");

        }

        return res.status(201).json(responseJson);
        
    } catch (error) {
        console.log({error});
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
};



export const orderStatus = async (req, res) => {
    
    console.log(req.query);

    if (req.query.orderId) {

        const order = await Order.findById(req.query.orderId, {owner:1, orderItems:1});
        console.log(order);
        if (order?.owner?.toString() === req?.session?.user?._id.toString()) {
            return res.status(STATUS_CODES.SUCCESS).render("order-confirmation", {success: true, order: req.query.orderId, item: order.orderItems[0]._id});
        }else{
            return res.redirect(`/api/user/order-confirmation?status=error`);
        }
        

    } else if (req?.session?.user?._id && req.query.status == "error") {

        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).render('order-confirmation', {success: false});

    } else {
        res.redirect(`/api/user/order-confirmation?status=error`);
    }

}


// ------------------ cancel order ------------------//

export const cancelOrder = async (req,res) => {

    const {itemId, orderId} = req.params;

    function findAllowedAction(orderItemStatus){
            
        const allowedAction = {
            created: "cancel",
            confirmed: "cancel", 
            processing: "cancel", 
            shipped: null, 
            delivered: "return", 
            cancelled: null
        };

        return allowedAction[orderItemStatus];
    }

    try {

        const order = await Order.findOne({_id: orderId, 'orderItems._id': itemId});
        
        if (!order){
            return res.status(400).json({success: false, error: "no such order found" });
        }

        const item = order.orderItems.id(itemId);
        if (!item){
            return res.status(400).json({success: false, error: "no such order item found" });
        }
        
        const product = await Product.findById(item.product);
        if (!product){
            return res.status(400).json({success: false, error: "no such product found" });
        }

        if (findAllowedAction(item.status) != 'cancel') {
            return res.status(400).json({success: false, error: 'cancellation not possible at this stage'});
        }

        item.status = 'cancelled';
        product.stock += item.quantity;

        await order.save();
        await product.save();

        return res.status(200).json({success: true, message: `order Cancelled successfully` });

    } catch (error) {
        return res.status(500).json({success: false, error: error.message });
    }
};



export const returnOrder = async (req,res) => {
    console.log("============ return order api - start ============");
    const {orderId, itemId} = req.params;

    function findAllowedAction(orderItemStatus){
        const allowedAction = {
            created: "cancel",
            confirmed: "cancel", 
            processing: "cancel", 
            shipped: null, 
            delivered: "return", 
            cancelled: null
        };

        return allowedAction[orderItemStatus];
    };


    try {

        const order = await Order.findOne({_id: orderId, 'orderItems._id': itemId});
        if (!order) return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: 'no such order found'});
        console.log({returnOrder:order}, "✅");

        const item = order.orderItems.id(itemId);
        if (!item) return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: 'no such order item found'});
        console.log({returnItem:item},"✅");

        const product = await Product.findById(item.product);
        console.log({returnProduct:product}, "✅");

        if (findAllowedAction(item.status) != 'return') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: 'This order is not eligible for return'});
        }

        const now = new Date();
        const itemDeliveredAt = item.deliveredAt;
        const maxReturnDate = new Date(itemDeliveredAt.getTime() + (product.returnPeriod * 24 * 60 * 60 * 1000));
        console.log({now, itemDeliveredAt, maxReturnDate, returnPeriod: product.returnPeriod}, "✅");
    
        if (now > maxReturnDate) return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Return period is over!"});

        item.returnStatus = "requested";
        item.returnReason = req.body.returnReason;

        await order.save();
        console.log("============ return order api - end ============");
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Return request submitted sucessfully"});


    } catch (err) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    }

};


//get individual order page
export const getOrder = async (req,res) => {

    // const {orderId, itemId} = req.params;

    const orderId = new Types.ObjectId(req.params.orderId);
    const itemId = new Types.ObjectId(req.params.itemId);
    console.log({orderId, itemId})
    
    try{

        const order = await Order.aggregate([
            
            {$match: {_id: orderId}},
            {$unwind: "$orderItems"},
            {$match: {"orderItems._id" : itemId}},
            {$lookup: {
                from: "products",
                localField: "orderItems.product",
                foreignField: "_id",
                as: "productData"
            }},
            {$unwind: "$productData"},
            
            {$lookup: {
                from: "addresses",
                localField: "address",
                foreignField: "_id",
                as: "addressData"
            }},
            {$unwind: "$addressData"}

        ]);

        console.log("//=========== Order ============//");
        console.log(order[0]);
        console.log("//=========== Order - End ============//");

        const otherItemsInOrder = await Order.aggregate([

            {$match: {_id: orderId}},
            {$unwind: "$orderItems"},
            {$match: {"orderItems._id": {$ne:itemId}}},
            {$lookup: {
                from: "products",
                localField: "orderItems.product",
                foreignField: "_id",
                as: "productData"
            }},
            {$unwind: "$productData"},
            {$project: {
                itemId: "$orderItems._id",
                productName: "$productData.productname",
                thumbnail: {$arrayElemAt: ["$productData.images", 0]}
            }}

        ]);

        console.log("//=========== otherItemsInOrder ============//");
        console.log(otherItemsInOrder);
        console.log("//=========== otherItemsInOrder - end ============//");

        
        function findAllowedAction(orderItemStatus){
            
            const allowedAction = {
                created: {action: "cancel", label: 'Cancel Order'},
                confirmed: {action: "cancel", label: 'Cancel Order'}, 
                processing: {action: "cancel", label: 'Cancel Order'}, 
                shipped: {action: null, label: ''}, 
                delivered: {action: "return", label: 'Return Order'}, 
                cancelled: {action: null, label: ''}
            };

            return allowedAction[orderItemStatus];
        };

        function buildOrderViewObject(order, otherItemsInOrder = []){

            const item = order[0].orderItems;
            const listingPrice = item.price;
            const quantity = item.quantity;
            const subTotal = listingPrice * quantity;
            const offerDiscount = (item.offerInfo?.discount * quantity) || 0;
            const couponDiscount = item.couponInfo?.itemDiscount || 0;
            const shippingFee = order[0].pricing?.shipping || 0;
            const totalDiscount = offerDiscount + couponDiscount;
            const grandTotal = (subTotal - totalDiscount) + shippingFee;
            const allowedActionForItem = item.returnStatus == "none" ? findAllowedAction(item.status) : null;
            const orderStatusCode = {
                created: 0, 
                confirmed: 1, 
                processing: 2, 
                shipped: 3, 
                delivered: 4, 
                cancelled: 5
            };
            console.log(allowedActionForItem);

            
            return {
                _id: order[0]._id,
                orderId: order[0].orderId ?? null,
                orderItem: {
                    _id: item._id,
                    productId: order[0].productData._id,
                    productName: order[0].productData.productname,
                    thumbnail: order[0].productData.images[0],
                    status: item.status,
                    statusCode: orderStatusCode[item.status],
                    returnStatus: item.returnStatus
                },
                couponInfo: item.couponInfo ? {...item.couponInfo} : null,
                pricing: {
                    listingPrice,
                    quantity,
                    subTotal,
                    offerDiscount,
                    couponDiscount,
                    shippingFee,
                    grandTotal
                },
                shipping: {
                    name: order[0].addressData.name,
                    phone: order[0].addressData.phone,
                    pin: order[0].addressData.pincode,
                    address: order[0].addressData.address,
                    city: order[0].addressData.city,
                    state: order[0].addressData.state
                },
                shippingUpdates: [...item.trackRecords],
                paymentMode: order[0].paymentInfo.mode,
                allowedActionForItem,
                otherItemsInOrder
            };
        };


        const orderView = buildOrderViewObject(order, otherItemsInOrder);
        console.log('Order view object \n', orderView);

        return res.status(STATUS_CODES.SUCCESS).render("order", {orderView});

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error : error.message});
    }

};




export const generateInvoice = async (req, res) => {

    const {orderId, itemId} = req.params;
    let invoiceData = {};
    const order = await Order.findById(orderId).populate('orderItems.product', 'productname').populate('address');
    const item = order.orderItems.id(itemId);

    console.log({order, item});
    invoiceData._id = order._id;
    invoiceData.invoiceNumber = generateInvoiceNumber(itemId);
    invoiceData.address = order.address;
    invoiceData.item = {
        product: item.product.productname,
        quantity: item.quantity,
        price: item.price,
        deliveredAt: item.deliveredAt
    };
    invoiceData.coupon = order.couponInfo;
    invoiceData.createdAt = new Date();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const htmlData = await ejs.renderFile(
        path.join(__dirname, '../views/invoice.ejs'),
        {invoiceData}
    );

    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlData);
    const pdfData = await page.pdf({
        format: 'A4',
        printBackground: true 
    })
    
    await browser.close();

    res.set({
        'Content-Type' : 'application/pdf',
        'Content-Disposition' : `attachment; filename=${invoiceData.invoiceNumber}.pdf`,
        'Content-Length' : pdfData.length
    });

    return res.end(pdfData);
};