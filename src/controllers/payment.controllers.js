import { Order } from "../models/order.model.js";
import { STATUS_CODES } from "../utils/constants/statusCodes.js";
import {razorpay, verifySign} from "../utils/razorpay.js";


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

};


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