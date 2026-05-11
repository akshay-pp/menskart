import { Cart } from "../models/cart.model";
import { Coupon } from "../models/coupon.model";
import { User } from "../models/user.model";
import { STATUS_CODES } from "../utils/constants/statusCodes";

export const isCouponValid = async(req,res) => {

    console.log(req.body);
    
    try {

        const regexedCode = new RegExp(`^${req.body.couponCode}$`, "i"); 

        const cart = await Cart.findOne(
            {owner: req.session.user._id},
            { totalPrice: 1, _id: 0 }
        );

        const user = await User.findById(
            req.session.user._id,
            {couponsUsed: 1, _id: 0}
        );

        const coupon = await Coupon.findOne(
            {
                $and: [
                    {code: regexedCode},
                    {couponActive: true},
                    {validFrom: {$lt: new Date()}},
                    {expiry: {$gt: new Date()}},
                    {$expr: {$lt: ['$usage', '$maxUsage']}},
                    {minimumCartValue: {$lte: cart.totalPrice}}
                ] 
            }, 
        
            {
                code: 1, description: 1, isPercent: 1, couponAmount: 1, maxDiscount: 1, expiry: 1
            }

        ).lean();

        console.log({coupon});

        if (coupon) {

            let discount;
            if (coupon.isPercent) {
                let percentDiscount = cart.totalPrice*(coupon.couponAmount/100);
                discount = percentDiscount > coupon.maxDiscount ?  coupon.maxDiscount : percentDiscount;
            } else {
                discount = coupon.couponAmount;
            }

            coupon.discount = discount;
            return res.status(STATUS_CODES.SUCCESS).json({success: true, coupon});

        } else {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Coupon invalid"});
        }

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }

}