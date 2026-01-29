import { Coupon } from "../models/coupon.model.js"

 

// return all the coupons applicable for the cart
export const getApplicableCoupons = async function(userId, couponsUsed, cart) {


}





// verify a specific coupon 
export const verifyCoupon = async function(couponInfo, couponsUsed, cartValue) {
    
    // @param couponInfo = {code, id}
    // @param couponsUsed = user.couponsUsed; [array]
    // @param cartValue = cart.totalPrice
    
    try {

        const hasUsedCoupon = couponsUsed.some(item => (item.coupon == couponInfo.code) && (item.couponId == couponInfo.id));
        
        if (hasUsedCoupon) {
            return {success: false, error: "Coupon already used"};
        }
    
        const verifiedCoupon = await Coupon.findOne(
            {
                $and: [
                        {_id: couponInfo.id},
                        {code: couponInfo.code},
                        {couponActive: true},
                        {validFrom: {$lte: new Date()}},
                        {expiry: {$gte: new Date()}},
                        {$expr: {$lt: ['$usage', '$maxUsage']}}
                    ]
            },
                    
            {
                code: 1, isPercent: 1, couponAmount: 1, maxDiscount: 1, minimumCartValue: 1
            }
        ).lean();

        if (!verifiedCoupon) {
            return {success: false, error: "Coupon expired or inactive"};
        
        } else if (cartValue < verifiedCoupon.minimumCartValue) {
            return {success: false, error: "Minimum cart value not met"};
        
        } else {
            return {success: true, coupon: verifiedCoupon};
        }

    } catch (err) {
        return {success: false, error: "Internal error"};
    }
} 



export const applyCoupon = function(verifiedCoupon, cartValue) {

    let discount;
    if (verifiedCoupon.isPercent) {
        let percentDiscount = cartValue * (verifiedCoupon.couponAmount/100);
        discount = Math.min(percentDiscount, verifiedCoupon.maxDiscount);
    } else {
        discount = verifiedCoupon.couponAmount;
    }

    const finalPrice = cartValue - discount;

    return {success: true, finalPrice, coupon: {...verifiedCoupon, discount}};

}