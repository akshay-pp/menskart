import {Types} from "mongoose";
import { verifyGoogleToken } from "../utils/verifyGoogleToken.js";
import { User } from "../models/user.model.js";
import { sendOtp, sendOrderConfirmation } from "../utils/nodemailer.js";
import {razorpay, verifySign} from "../utils/razorpay.js";
import {generateInvoiceNumber, generateOrderId, generateReferralCode, generateCheckoutSessionId} from "../utils/idGenerator.js";
import { Product } from "../models/product.model.js";
import {Category} from "../models/category.model.js";
import { Address } from "../models/address.model.js";
import { Cart } from "../models/cart.model.js";
import { Order } from "../models/order.model.js";
import { Wishlist } from "../models/wishlist.model.js";
import {Coupon} from "../models/coupon.model.js";
import {Wallet} from "../models/wallet.model.js";
import {Offer} from "../models/offer.model.js";
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import {fileURLToPath} from 'url';
import {findBestPrice} from '../utils/calculateOfferPrice.js';
import {applyOfferPricesToCart, pricingBreakdown} from '../utils/pricing.js';
import {applyCouponToCart} from '../utils/couponServices.js';
import {formatDate} from '../utils/formatDate.js';
import {paginate} from '../utils/paginate.js';
import {STATUS_CODES} from '../utils/constants/statusCodes.js';
import { PAGINATION_CONFIG } from "../utils/constants/config.js";



//homepage
export const getHome = async (req,res)=> {

    const user = req.session.user || null;
    const newArrivals = await Product.find({}).populate("category", "name").populate("subcategory", "name").sort({createdAt: -1}).limit(PAGINATION_CONFIG.DEFAULT_LIMIT);
    const bestSellers = await Product.find({}).populate("category", "name").populate("subcategory", "name").sort({stock: 1}).limit(PAGINATION_CONFIG.DEFAULT_LIMIT);
    res.status(STATUS_CODES.SUCCESS).render('index', {user, newArrivals, bestSellers});

}



export const getLogin = async (req,res) => {
    res.status(STATUS_CODES.SUCCESS).render("login");
}

//user login
export const loginUser = async (req, res) => {
    
    console.log("request hit")
    const { email, password } = req.body;
    console.log(req.body);

    if(!email || !password){
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "all fields are required" });
    } else {

        try {

            const user = await User.findOne({ email });
      
            if (!user) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "No user found for the email" });
            }

            if(user?.isBlocked){
                return res.status(STATUS_CODES.FORBIDDEN).json({ success: false, error: "You're blocked from accessing the website" });
            }
      
            const isPasswordValid = await user.verifyPassword(password);
      
            if (!isPasswordValid) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "Incorrect password" });
            }
            
            req.session.user = user;
            const wallet = await Wallet.findOneAndUpdate(
                {owner: user._id},
                {$setOnInsert: {balance: 0, transaction: []}},
                {upsert: true, new: true}
            );

            const referralCode = generateReferralCode(req.session.user.fullname);
            await User.findOneAndUpdate(
                { _id: user._id, referralCode: { $exists: false } },
                {$set: {referralCode, referrals: []}},
                {new: true}
            );

            console.log(wallet);

            return res.status(STATUS_CODES.SUCCESS).json({ success: true, message: "Logging you in.." });
            
        } catch (error) {
            console.error(error);
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
        }
    }
  
   
};



//register new user
export const registerUser = async(req,res) => {

    const {fullname, email, password, confirmPassword, referralInput} = req.body;
    console.log(req.body);
    let isEmpty = [fullname, email, password, confirmPassword].some(item => item?.trim() === "")


    if (isEmpty){
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "All fields are required" });
    } else if (password != confirmPassword){
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "passwords doesn't match" });
    }
    else {

        try {
            
            const existingUser = await User.findOne({email});

            if(existingUser){
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "User with email already exists"});
            } else {

                let referredBy;
                if (referralInput) {
                    referredBy = await User.findOne({referralCode: referralInput}, {_id: 1});
                    if (!referredBy){
                        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "Invalid Referral Code"});
                    };
                };

                const user = {fullname, email, password, referredBy: referredBy?._id || null};
                req.session.temp = user;
                const otp = await sendOtp(email);
                const expiry = Date.now()+(60*1000);
                console.log(req.session.temp);     //for debugging
                req.session.otp = {otp, expiry};
                console.log(req.session.otp);     //for debugging
                return res.status(STATUS_CODES.SUCCESS).json({ success: true, message: "otp sent successfully"});
                
            }

        } catch (error) {
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message});
        }

    }
}


//user registration otp validation
export const verifyRegistration = async (req,res) => {
    
    const {otp} = req.body;

    if(req.session.otp.otp && req.session.otp.otp == otp){

        if (req.session.otp.expiry < Date.now()){
            return res.status(STATUS_CODES.FORBIDDEN).json({ success: false, error: "Otp Expired"});
        }
        
        const {fullname, email, password, referredBy} = req.session.temp;
        try {

            const referralCode = generateReferralCode(fullname);
            const user = await User.create({fullname, email, password, referralCode, referredBy});
            const newUser = await User.findById(user._id);
            
            if (!newUser){
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: "error creating user"})
            } else {
                req.session.user = newUser;
                await Wallet.create({owner: user._id, balance: 0, transactions: []});

                if (referredBy) {
                    await User.findByIdAndUpdate(referredBy, {$addToSet: {referrals: user._id }});
                    
                    const newTransactionReferredBy = {
                        amount: 200,
                        direction: 'Credit',
                        source: 'referral',
                        referee: user._id,
                        status: 'success'
                    };
        
                    await Wallet.findOneAndUpdate(
                        {owner: referredBy}, 
                        {
                            $push: {transactions: newTransactionReferredBy},
                            $inc: {balance: 200}
                        }
                    );

                    const newTransactionReferee = {
                        amount: 200,
                        direction: 'Credit',
                        source: 'referral',
                        status: 'success'
                    };

                    await Wallet.findOneAndUpdate(
                        {owner: user._id}, 
                        {
                            $push: {transactions: newTransactionReferee},
                            $inc: {balance: 200}
                        }
                    );
                }
                return res.status(STATUS_CODES.SUCCESS).json({ success:true, message: "otp verified. redirecting...", url: "/"});

            }

        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message})
        }
    }else{
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "Incorrect otp"});
    }

}



//user registration resend otp
export const resendOtp = async(req,res) => {
    try {
        if(!req.session.temp && !req.session.email){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error:"unauthorized"});
        
        }else if(req.session?.otp?.expiry > Date.now()) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error:"Please wait for a while..."});
        
        }else{
            const email = req.session?.temp?.email ?? req.session?.email
            const otp = await sendOtp(email);
            const expiry = Date.now()+(60*1000); 
            req.session.otp = {otp, expiry};

            console.log(`Generated otp : ${otp}`)     //for debugging

            return res.status(STATUS_CODES.SUCCESS).json({ success: true, message: "Otp resent successfully" });
        }
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error:error.message });
    }
}



//user profile
export const getProfile = async (req,res) => {

        const tab = req.params.tab || "dashboard";
        let data = {};

        try {

            if (tab === "address") {
                data.address = await Address.find({owner: req.session.user._id})
            }

            if (tab === "orders"){
                
                const page = parseInt(req.query.page) || 1;
                const limit = PAGINATION_CONFIG.DEFAULT_LIMIT;
                const skip = (page-1) * limit;

                const totalDocs = await Order.countDocuments({
                    owner: req.session.user._id,
                    $nor: [{
                        'paymentInfo.mode': 'razorpay',
                        'paymentInfo.status': {$in: ['pending', 'failed']}
                    }]
                });

                const orders = await Order.aggregate ([
                    
                    {$match:{
                        owner: req.session.user._id,
                        $nor: [{
                            'paymentInfo.mode': 'razorpay',
                            'paymentInfo.status': {$in: ['pending', 'failed']}
                        }]
                    }},
                    {$sort: {createdAt: -1}},
                    {$unwind: "$orderItems"},
                    {$sort: {createdAt: -1}},
                    {$lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "orderItems.productData"
                    }},
                    {$unwind: "$orderItems.productData"},
                    {$skip: skip},
                    {$limit: limit}
    
                ]);

                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                const pendingOrders = await Order.aggregate ([
                    
                    {$match:{
                        owner: req.session.user._id,
                        'paymentInfo.mode': 'razorpay',
                        'paymentInfo.status': {$in: ['pending', 'failed']},
                        createdAt: {$gte: fifteenMinutesAgo}
                    }},
                    {$sort: {createdAt: -1}},
                    {$unwind: "$orderItems"},
                    {$sort: {createdAt: -1}},
                    {$lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "orderItems.productData"
                    }},
                    {$unwind: "$orderItems.productData"},
                    {$limit: 2}
    
                ]);

                console.log(pendingOrders);

                const totalPages = Math.ceil(totalDocs/limit);
    
                data.page = page;
                data.totalDocs = totalDocs;
                data.totalPages = totalPages;
                data.orders = orders;
                data.pendingOrders = pendingOrders || [];
                
            };

            if (tab === "wallet") {
                const wallet = await Wallet.findOneAndUpdate(
                    {owner: req.session.user._id},
                    {$setOnInsert: {balance: 0, transactions: []}},
                    {new: true, upsert: true}
                ).lean();

                const walletUiData = {
                    Credit: {
                        badgeClass: "bg-secondary",
                        amountPrefix: `+ ₹`,
                        amountClass: 'text-success',
                        sources: {
                            refund: 'Refund for: ',
                            referral: 'Referal reward'
                        }
                    },

                    Debit: {
                        badgeClass: "bg-danger",
                        amountPrefix: `- ₹`,
                        amountClass: 'text-danger',
                        sources: 'Paid for order'
                    }
                };

                wallet.transactions?.forEach(item => {
                    const ui = walletUiData[item.direction];
                    item.badgeClass = ui.badgeClass;
                    item.date = formatDate(item.createdAt);
                    item.amountText = `${ui.amountPrefix}${item.amount}`;
                    item.amountClass = ui.amountClass;
                    item.description = typeof ui.sources === 'object' ? ui.sources[item.source] : ui.sources;
                });

                wallet.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                data.wallet = wallet;
            };
            console.log(data);
            return res.status(STATUS_CODES.SUCCESS).render("profile", {activeTab: tab, ...data });
        
        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }

};




//---------------------- forgot-password ----------------------//


//fetch email and send otp 
export const forgotPassword = async(req,res) => {

    const {email} = req.body;

    try {

        const user = await User.findOne({email});
        
        if(!user){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "no account associated with this email"});
        }

        const otp = await sendOtp(email);
        const expiry = Date.now()+(60*1000); 
        req.session.email = email;
        req.session.otp = {otp, expiry};
        console.log(req.session.otp);

        return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "otp sent successfully"})


    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error: error.message});
    }

}


//verify otp
export const verifyForgotOtp = async (req,res) => {

    if (req.session?.otp?.otp != req.body.otp){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "incorrrect otp"});
    }

    if (req.session?.otp?.expiry < Date.now()){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "otp expired", otpExpired: true});
    }

    if (req.session?.otp?.otp == req.body.otp){
        return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "otp verified"});
    }


}


//reset password
export const resetPassword = async (req,res) => {

    const {newPassword, confirmPassword} = req.body;
    console.log(req.body);
    
    if (newPassword != confirmPassword){
        return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "passwrods doesn't match"});
    }

    const user = await User.findOne({email:req.session.email});
    user.password = newPassword;

    try {
        await user.save();
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "password updated successfully"});
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
    
}


//--------------------------------------------//





//------------------- cart operations -------------------//

//get cart page
export const getCart = async (req,res) => {

    const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product', 'productname price images stock maxQuantity');

    if (!cart || cart.items.length == 0){
        return res.render("cart", {cart, isEmpty: true});
    }
    const cartWithOffersApplied = await applyOfferPricesToCart(cart);
    // const productIds = cart.items.map(item => item.product._id);
    // // console.log({productIds})

    // const products = await Product.find({_id: {$in: productIds}}).lean();
    // // console.log({products});

    // const finalProductData = await findBestPrice(...products);
    // // console.log({finalProductData});

    // const priceMap = new Map();
    // finalProductData.forEach(product => {
    //     priceMap.set(product._id.toString(), product.offerPrice);
    // });
    // // console.log(priceMap);

    // cart.items.forEach(item => {
    //     // console.log({price: priceMap.get(item.product._id.toString())});
    //     const currentPrice = priceMap.get(item.product._id.toString());
    //     if (currentPrice <= item.price) {
    //         item.offerPrice = currentPrice;
    //     }
    // })

    // cart.totalPrice = cart.items.reduce((total, item) => {
    //     let currentPrice = item.offerPrice ?? item.price;
    //     return  total + (currentPrice * item.quantity);
    // },0)

    console.log(cartWithOffersApplied);

    return res.render("cart", {cart: cartWithOffersApplied, isEmpty: false});

}


//add to cart
export const addToCart = async (req,res) => {

    const productId = req.body.productId;
    const quantity = req.body.quantity || 1;

    try {

        const product = await Product.findById(productId);

        // validations

        if(!product){
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: "error fetching product"});
        }

        if(quantity > product.maxQuantity){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `Maximum quantity for ${product.productname} is ${product.maxQuantity}`});
        }

        if(quantity > product.stock){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `Sorry! Not enough stock`});
        }

        if(product.stock <= 0){
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: "Product out of stock"});
        }

        // validations - end


        let cart;
        try {
            cart = await Cart.findOne({owner: req.session.user._id});
        } catch (error) {

            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});

        }

        // create cart and add product if no existing cart

        if(!cart){

            cart = new Cart({

                owner: req.session.user._id,
                items: [
                    {
                        product: productId,
                        price: product.price,
                        quantity
                    }
                ]
            });

            await cart.save();
            return res.status(201).json({success: true, message: "Cart created and product added", cart});
        
        }
        
        // 
        

        // if product is already in cart
        const existingProduct = cart.items.find(item => item.product.toString() == productId)
        if (existingProduct) {
            return res.status(STATUS_CODES.SUCCESS).json({success: false, error: "Item already in cart"});
        } else {
            const cartItem = {product: productId, price: product.price, quantity};
            cart.items.push(cartItem);
        }


        await cart.save();



        // if added from wishlist, remove the product from wishlist
        if (req.body.referer == "wishlist") {

            try {
                const wishlist = await Wishlist.findOne({owner: req.session.user._id});
                wishlist.products = wishlist.products.filter(item => item.toString() != productId);
                await wishlist.save();
            } catch (error) {
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
            }
        }

        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: `${product.productname} has been added to the cart`, cart});
        
        
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }

}


//remove from cart
export const removeFromCart = async(req,res) => {

    const {cartItemId} = req.body;
    try {
        
        const cart = await Cart.findOne({owner: req.session.user._id});
        console.log(cart);

        if(!cart){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Cart not found"});
        }

        if (cart.items.find(item => item._id.toString() == cartItemId)){
            try {
                cart.items = cart.items.filter(item => item._id.toString() != cartItemId);
                await cart.save();
                const cartWithOffersApplied = await applyOfferPricesToCart(cart);

                return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Product successfully removed from cart", total: cartWithOffersApplied.totalPrice});
            } catch (error) {
                console.log({cartItemId, itemId: item._id})
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
            }
        } else {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Cart item not found"});
        }
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error : error.message});
    }

}


//update quantity
export const updateQuantity = async(req,res) => {

    const {itemId} = req.params;
    const {quantity} = req.body;

    try {
    
        const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product');
        let item = cart.items.find(item => item._id == itemId);
        console.log(item);

        if (item.product.stock < quantity) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Not enough stock" });
        }

        if (quantity > item.product.maxQuantity) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `limited to ${item.product.maxQuantity} per user`});
        }
         
        item.quantity = quantity;
        let lastUpdatedQuantity = Math.min(quantity, item.product.stock)
        await cart.save();
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Quantity updated", lastUpdatedQuantity})

    } catch (error) {

        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    
    }

}

//--------------------------------------------//






//------------------- wishlist operations -------------------------//

//get wishlist
export const getWishlist = async(req,res) => {

    try {
        
        const wishlist = await Wishlist.findOne({owner: req.session.user._id}).populate('products');

        if (!wishlist || wishlist.products.length == 0){
            return res.render("wishlist", {wishlist, isEmpty: true});
        }

        return res.render("wishlist", {wishlist, isEmpty: false});

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
};



//add to wishlist
export const addToWishlist = async(req,res) => {

    const {productId} = req.params;

    console.log({path: req.path});

    try {
        
        const product = await Product.findById(productId);
        console.log('product query success ✅');

        if (!product){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Product doesn't exist"});
        }

        let wishlist = await Wishlist.findOne({owner: req.session.user._id});
        console.log('wishlist query success ✅');

        if (!wishlist){
            wishlist = new Wishlist({
                owner: req.session.user._id
            });
        }

        if (wishlist.products.find(item => item.toString() == productId)){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Product already exists in wishlist"});
        }

        wishlist.products.push(productId);
        await wishlist.save();

        return res.status(STATUS_CODES.SUCCESS).json({success: true, isAdded: true, message: "Product added to wishlist"});
        

    } catch (error) {

        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    
    }

};


//remove from wishlist
export const removeFromWishlist = async (req,res) => {

    const {productId} = req.params;

    try {

        const wishlist = await Wishlist.findOne({owner: req.session.user._id});
        
        //validations
        wishlist.products = wishlist.products.filter(item => item.toString() != productId);
        await wishlist.save();
        
        return res.status(STATUS_CODES.SUCCESS).json({success: true, isRemoved: true, message: "Product removed from wishlist"});

    }catch (error){
        
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
};



//offer operations







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
        
        if(!user) {
            return res.status(STATUS_CODES.NOT_FOUND).json({success: false, error: "User not found."});
        }

        if(!cart) {
            return res.status(STATUS_CODES.NOT_FOUND).json({success: false, error: "Cart not found."});
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




//check if coupon is valid
export const isCouponValid = async(req,res) => {

    console.log(req.body);
    
    try {

        const regexedCode = new RegExp(`^${req.body.couponCode}$`, "i"); 
        let coupon = {};
        const cart = await Cart.findOne({owner: req.session.user._id});

        let couponInSearch = await Coupon.findOne({code: regexedCode}, {code: 1, description: 1, expiry: 1}).lean();
        if (!couponInSearch) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Invalid Coupon"});
        };

        if (req.body.couponId) {
            coupon = {
                code: req.body.couponCode,
                id: req.body.couponId
            };
        } else {
            coupon = {
                code: req.body.couponCode,
                id: couponInSearch._id
            };
        }
        console.log(coupon);
        const cartWithOffersApplied = await applyOfferPricesToCart(cart);
        const cartWithCouponApplied = await applyCouponToCart(coupon, cartWithOffersApplied, req.session.user._id);
        const {isCouponValid = true, error} = cartWithCouponApplied;

        // console.log(cartWithCouponApplied, {isCouponValid, error});
        
        if (!isCouponValid) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: cartWithCouponApplied.error});
        };
        
        couponInSearch.discount = cartWithCouponApplied.couponInfo?.discount;
        console.log(cartWithCouponApplied);

        return res.status(STATUS_CODES.SUCCESS).json({success: true, cart: cartWithCouponApplied, coupon: couponInSearch});
        // const user = await User.findById(
        //     req.session.user._id,
        //     {couponsUsed: 1, _id: 0}
        // );

        // const coupon = await Coupon.findOne(
        //     {
        //         $and: [
        //             {code: regexedCode},
        //             {couponActive: true},
        //             {validFrom: {$lt: new Date()}},
        //             {expiry: {$gt: new Date()}},
        //             {$expr: {$lt: ['$usage', '$maxUsage']}},
        //             {minimumCartValue: {$lte: cart.totalPrice}}
        //         ] 
        //     }, 
        
        //     {
        //         code: 1, description: 1, isPercent: 1, couponAmount: 1, maxDiscount: 1, expiry: 1
        //     }

        // ).lean();

        // console.log({coupon});

        // if (coupon) {

        //     let discount;
        //     if (coupon.isPercent) {
        //         let percentDiscount = cart.totalPrice*(coupon.couponAmount/100);
        //         discount = percentDiscount > coupon.maxDiscount ?  coupon.maxDiscount : percentDiscount;
        //     } else {
        //         discount = coupon.couponAmount;
        //     }

        //     coupon.discount = discount;
        //     return res.status(STATUS_CODES.SUCCESS).json({success: true, coupon});

        // } else {
        //     return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Coupon invalid"});
        // }

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }

}





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



export const verifyRazorpayPayment = async (req, res) => {

    console.log({razorpay_response : req.body});
    const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body;
    
    const isVerified = verifySign (
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        process.env.RAZORPAY_KEY_SECRET
    );

    if (isVerified.success) {

        const newOrder = await Order.findById(req.session.tempOrderId);
        
        //update order and payment status
        newOrder.orderStatus = "confirmed";
        newOrder.orderItems.forEach(item => item.status = "confirmed");
        newOrder.paymentInfo.status = "completed";
        newOrder.paymentInfo.razorpayInfo = {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
        };
        
        await newOrder.save();
        console.log({newOrder, verified: true});

        //post-order tasks

        // 1- update stock
        const cart = await Cart.findOne({owner: req.session.user._id}).populate('items.product');
        for (const item of cart.items) {

            const product = await Product.findById(item.product._id); 
            product.stock -= item.quantity;
            await product.save();

        }
        console.log("stock updation check - razorpay ✅");


        // 2- empty cart
        cart.items = [];
        await cart.save();
        console.log("cart emptied - razorpay ✅");


        // 3- update coupon info 
        if (req.session.couponInfo) {

            let couponUsed = {
                couponId: req.session.couponInfo.couponId,
                coupon: req.session.couponInfo.couponCode
            };

            await User.findByIdAndUpdate(
                req.session.user._id,
                {$addToSet: {couponsUsed: couponUsed}}
            );

            await Coupon.findByIdAndUpdate(
                req.session.couponInfo.couponId, 
                {$inc: {usage: 1}}
            );

        }

        await sendOrderConfirmation(req.session.user.email, newOrder);

        return res.json({success: true, redirectUrl: `/api/user/order-confirmation?orderId=${newOrder._id}&status=success`})

    } else {

        // 1- mark order as payment-pending
        const newOrder = await Order.findById(req.session.tempOrderId);
        newOrder.paymentInfo.status = "pending";

        // 2- payment-status is pending
        // 3- 
        return res.json({success: false, redirectUrl: `/api/user/order-confirmation?status=error`})

    }

}


export const handleRazorpayPaymentFailure = async (req, res) => {
    const {response} = req.body;
    console.log({response: response.error.metadata});
    if (req?.session?.tempOrderId) {
        const order = await Order.findById(req.session.tempOrderId);
        order.paymentInfo.status = "failed";
        order.paymentInfo.razorpayInfo = {
            razorpayOrderId: response.error.metadata.order_id,
            razorpayPaymentId: response.error.metadata.payment_id
        };
        console.log({order});
        await order.save();
    }
    return res.status(STATUS_CODES.NOT_FOUND).json({success: false, redirectUrl: `/api/user/order-confirmation?status=error`});
};

export const retryRazorpayPayment = async (req, res) => {
    const {orderId} = req.body;
    try {
        const order = await Order.findById(orderId);
        req.session.tempOrderId = order._id;
        const razorpayOrder  = await razorpay.orders.create({
            amount: order.pricing.grandTotal*100,
            currency: "INR",
            receipt: `receipt#${order.orderId}`,
            payment_capture: 1
        })

        console.log({razorpayOrder});
        let responseJson = {
            success: true,
            razorpayOrder,
            prefill: {
                name: req.session.user.fullname,
                email: req.session.user.email,
                contact: req.session.user.phone
            },
            key: process.env.RAZORPAY_KEY_ID
        };

        console.log(responseJson);

        return res.status(STATUS_CODES.SUCCESS).json(responseJson);

    } catch(err){
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    } 
}




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
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "no such order found" });
        }
        console.log(order);

        const item = order.orderItems.id(itemId);
        if (!item){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "no such order item found" });
        }
        console.log(item);

        

        const product = await Product.findById(item.product);
        if (!product){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "no such product found" });
        }

        if (findAllowedAction(item.status) != 'cancel') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: 'cancellation not possible at this stage'});
        }

        item.status = 'cancelled';
        product.stock += item.quantity;

        // check if order is paid
        // cod - instant cancel
        // razorpay - payment completed - refund to wallet
        if (order.paymentInfo?.mode == "razorpay" && order.paymentInfo?.status == "completed") {
            const amountToRefund = item.finalPrice ?? (item.price*item.quantity);
            const newTransaction = {
                amount: amountToRefund,
                direction: 'Credit',
                source: 'refund',
                relatedOrder: {
                    orderId,
                    itemId
                },
                refundType: 'cancel',
                status: 'success'
            };
            //update wallet
            const wallet = await Wallet.findOneAndUpdate(
                {owner: order.owner},
                {$setOnInsert: {balance: 0, transaction: []}},
                {upsert: true, new: true}
            );

            console.log(amountToRefund, newTransaction, wallet);

            wallet.balance += amountToRefund;
            wallet.transactions.push(newTransaction);
            await wallet.save();
        }

        await order.save();
        await product.save();

        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: `Order cancelled successfully` });

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message });
    }
}



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

}


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
                paymentStatus: order[0].paymentInfo.status,
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

}




export const generateInvoice = async (req, res) => {

    const {orderId, itemId} = req.params;
    let invoiceData = {};
    const order = await Order.findById(orderId).populate('orderItems.product', 'productname').populate('address');
    const item = order.orderItems.id(itemId);

    const listingPrice = item.price;
    const quantity = item.quantity;
    const subTotal = listingPrice * quantity;
    const offerDiscount = (item.offerInfo?.discount * quantity) || 0;
    const couponDiscount = item.couponInfo?.itemDiscount || 0;
    const shippingFee = order.pricing?.shipping || 0;
    const totalDiscount = offerDiscount + couponDiscount;
    const grandTotal = (subTotal - totalDiscount) + shippingFee;

    // console.log({order, item});
    invoiceData._id = order._id;
    invoiceData.invoiceNumber = generateInvoiceNumber(itemId);
    invoiceData.address = order.address;
    invoiceData.item = {
        product: item.product.productname,
        quantity,
        deliveredAt: item.deliveredAt
    };

    invoiceData.pricing = {
        listingPrice,
        subTotal,
        offerDiscount,
        couponDiscount,
        shippingFee,
        totalDiscount,
        grandTotal
    }
    invoiceData.coupon = order.couponInfo;
    invoiceData.createdAt = new Date();
    
    console.log(invoiceData);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const htmlData = await ejs.renderFile(
        path.join(__dirname, '../views/invoice.ejs'),
        {invoiceData}
    );

    const browser = await puppeteer.launch({
        executablePath: "/usr/bin/chromium-browser",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
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
}

//------------------- address operations -------------------------//

//add address
export const addAddress = async (req,res) => {

    console.log(req.body);
    
    if(!req.session.user){
        return res.redirect("/");
    }

    try {

        const newAddress = new Address({
            owner : req.session.user._id,
            name : req.body.addressName,
            phone : req.body.addressPhone,
            pincode : req.body.addressPincode,
            address : req.body.addressTextarea,
            city : req.body.addressCity,
            type : req.body.addressType,
            state : req.body.addressState
        });
    
        await newAddress.save();

        console.log(newAddress);
        return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "New address added successfully", address: newAddress})

    } catch (error) {

        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});

    }

};


//delete address
export const deleteAddress = async (req,res) => {
    
    if(req.session.user){

        const {addressId} = req.params;
        try {

            await Address.findByIdAndDelete(addressId);
            return res.redirect("/api/user/profile/address");
        
        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error: error.message});
        }

    }else{
        return res.redirect("/");
    }

};



//edit address
export const editAddress = async (req,res) => {

    if(req.session.user){

        try {
            
            /////validation pending
            const address = await Address.findById(req.body.editAddressId);
            address.name = req.body.editAddressName;
            address.phone = req.body.editAddressPhone;
            address.pincode = req.body.editAddressPincode;
            address.address = req.body.editAddressTextarea;
            address.city = req.body.editAddressCity;
            address.type = req.body.editAddressType;
            address.state = req.body.editAddressState;
            await address.save();
            return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "Address updated successfully", address});

        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }
    }else{
        return res.redirect("/");
    }
}

//--------------------------------------------//



//logout user
export const logoutUser = async(req,res) => {

    if(req.session.user){
        req.session.destroy();
        res.redirect("/");
    }

}



//sign in - sign up with google
export const signUpGoogle = async (req, res) => {

    const {credential} = req.body;

    if(!credential){
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "No credential"});
    }

    try {
        
        const userInfo = await verifyGoogleToken(credential);
        const user = await User.findOne({email: userInfo.email});
        
        if(user) {
            req.session.user = user;

            const wallet = await Wallet.findOneAndUpdate(
                {owner: user._id},
                {$setOnInsert: {balance: 0, transaction: []}},
                {upsert: true, new: true}
            );

            console.log(wallet);
        } else {

            const newUser = await User.create({ fullname: userInfo.name, email: userInfo.email, createdWith: "google" });
            req.session.user = newUser;
            await Wallet.create({owner: req.session.user._id, balance: 0, transactions: []});

            console.log(newUser);
        }

        const referralCode = generateReferralCode(req.session.user.fullname);
        await User.findOneAndUpdate(
            { _id: user._id, referralCode: { $exists: false } },
            {$set: {referralCode, referrals: []}},
            {new: true}
        );

        return res.redirect("/");

    } catch (error) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error});
    }

}



//-------------------- edit profile ------------------------//

//edit profile name
export const editProfileName = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const user = await User.findByIdAndUpdate(req.session.user._id, {fullname: req.body.updatedFullName} , {new:true});
            req.session.user.fullname = req.body.updatedFullName;
            console.log(user);
            return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Name updated successfully", firstname: user.fullname.split(" ")[0], lastname: user.fullname.split(" ")[1]});

        
        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

}


//edit phone
export const editPhone = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const user = await User.findByIdAndUpdate(req.session.user._id, {phone: req.body.updatedPhone} , {new:true});
            req.session.user.phone = req.body.updatedPhone;
            console.log(user);
            res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Phone Number updated successfully", phone: user.phone});

        
        } catch (error) {
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

};


//edit email
export const editEmail = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const oldOtp = await sendOtp(req.session.user.email);
            const newOtp = await sendOtp(req.body.updatedEmail);
            const expiry = Date.now()+(60*1000);
            req.session.oldOtp = oldOtp;
            req.session.newOtp = newOtp;
            req.session.otpExpiry = expiry;
            req.session.updatedEmail = req.body.updatedEmail;

            console.log(req.session.oldOtp, req.session.newOtp);
            res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Otp sent successfully to both emails"});

        
        } catch (error) {
            console.log(error);
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

};


//confirm email
export const confirmEmail = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){
        
        if (!req.session.updatedEmail){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "unauthorized"});
        }
    
        if (req.session.otpExpiry < Date.now()){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "otp expired"});
        }
    
        if(req.session.oldOtp == req.body.oldOtp && req.session.newOtp == req.body.newOtp){
    
            try {
                
                const user = await User.findByIdAndUpdate(req.session.user._id, {email: req.session.updatedEmail}, {new:true});
                req.session.user.email = req.session.updatedEmail;
                console.log(user);
                return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Email updated successfully", email:user.email});
    
            
            } catch (error) {
                console.log(error);
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
            }
    
        }

    }else{
        return res.redirect("/");
    }

};


//--------------------------------------------//



//list products
export const getProducts = async(req,res) => {
    
    try {

        //category filter
        let filter = {
            isUnListed: false,
            stock: {$gt: 0},
        };

        const categoryArray = [].concat(req.query.category || []);
        let categoryIdArray = [];
        console.log({categoryArray});
        
        if (Array.isArray(categoryArray) && categoryArray.length) {
            try {
                const categoryIds = await Promise.all(categoryArray.map(category => Category.findOne({name: category}, '_id')));
                categoryIdArray = categoryIds.map(item => item._id);
                filter.category = {$in: categoryIdArray};
            } catch (err) {
                if (err) {
                    return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: err.message});
                }
            }
        };

        let populate = [
            { path: 'category',select: 'name _id' }
        ];
        
        const options = {
            page: req.query.page,
            limit: req.query.limit || PAGINATION_CONFIG.DEFAULT_LIMIT,
            sort: req.query.sort,
            filters: filter,
            populate, 
        };

        let {q} = req.query;
        if(q && q.trim() !== ""){
            options.search = q;
            // filter.$text = {$search: q};
        }
        console.log(options);
        const {data: productdata, pagination, sort} = await paginate(Product, options); 

        //categories and no of products in each category
        const categoryData = await Product.aggregate([

            {
                $group : {
                    _id: '$category',
                    count: {$sum:1}
                }
            },

            {
                $lookup : {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },

            {
                $unwind: '$categoryDetails'
            }

        ]);

        // console.log('category query success ✅')

        
        
        let wishlist, wishlistSet; 
        if (req.session?.user?._id) {
            wishlist = await Wishlist.findOne({owner: req.session.user._id}).lean();
            wishlistSet = new Set(wishlist?.products?.map(id => id.toString()));
        }

        // console.log('wishlist query done ✅')



        
        // ------------- offer fetching and calculations 
        const productDataWithOffer = await findBestPrice(...productdata);

        const finalProductData = productDataWithOffer.map(product => {
            const isWishlisted = wishlist ? wishlistSet.has(product._id.toString()) : false;
            return {...product, isWishlisted};
        })

        // console.log({finalProductData});


        const categData = categoryData.map(category => {
            return {category: category.categoryDetails.name, count: category.count}
        });

        // console.log('final categData success ✅')
        
        // return res.status(STATUS_CODES.SUCCESS).json({finalProductData, pagination, page: pagination.currentPage, totalPages: pagination.totalPages, sort, categData, categoryArray});
        return res.status(STATUS_CODES.SUCCESS).render('user-product-list', {finalProductData, pagination, page: pagination.currentPage, totalPages: pagination.totalPages, sort, categData, categoryArray, q});
        
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
}


//product page
export const getProductPage  = async(req,res) => {

    const {pId} = req.params;
    const user = req.session.user || null;

    
    const productData = await Product.findById(pId).populate("category", "name _id").populate("subcategory", "name").lean();

    if(productData.isUnListed) {
        return res.redirect("/api/user/products");
    };
    
    let isWishlisted = false;

    if (user) {
        isWishlisted = !!(await Wishlist.exists({
            owner: req.session.user._id,
            products: pId
        }))
    }

    console.log({productData, isWishlisted});

    let relatedProducts = await Product.find(

        {
            category: productData.category,
            _id: {$ne: pId},
            isUnListed: false,
            stock: { $gt: 0 }
        }
    
    ).populate("category", "name");
    
    
    
    // ------------- offer fetching and calculations 

    const finalProductData = await findBestPrice(productData);
    console.log({finalProductData: finalProductData[0]});
    // const now = new Date();
    // const offer = await Offer.findOne({
    //     isActive: true,
    //     validFrom: {$lte: now},
    //     expiry: {$gte: now},
    //     "appliesTo.categName" : productData.category.name
    // }).lean();


    // let offerPrice, product;
    // if (offer) {

    //     if(offer.isPercent){
    //         offerPrice = productData.price - (productData.price * offer.offerAmount/100);
    //     }else{
    //         offerPrice = productData.price - offer.offerAmount;
    //     }

    //     product = {
    //         ...productData.toObject(),
    //         offerPrice,
    //         offer: offer.name 
    //     };

    // }else{
        
    //     offerPrice = productData.price;

    //     product = {
    //         ...productData.toObject(),
    //         offerPrice
    //     };
    // }

    // --------- offer fetching and calculations end

    return res.status(STATUS_CODES.SUCCESS).render("user-product-page", {
        finalProductData: finalProductData[0],
        user,
        relatedProducts,
        isWishlisted
    });


};


//set cart count
export const countCart = async (req, res, next) => {
        
    let cartCount = 0;
    if (req.session?.user){
  
      const cart = await Cart.findOne({owner: req.session.user._id});
      cartCount = cart ? cart.items.length : 0;
    
    }
    res.locals.cartCount = cartCount;
    next();
};


export const countWishlist = async (req, res, next) => {

    let wishlistCount = 0;

    if (req.session?.user){

        try{

            const wishlist = await Wishlist.findOne({owner: req.session.user._id});
            wishlistCount = wishlist ? wishlist.products.length : 0;

        }catch(error){

            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: error.message});

        }
    }

    res.locals.wishlistCount = wishlistCount;
    next();
};


//404 error page
export const errorPage = async (req,res) => {
    
    const user = req.session.user || null;
    res.status(STATUS_CODES.NOT_FOUND).render("404", {user});

};