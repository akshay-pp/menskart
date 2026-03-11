import { User } from "../models/user.model.js";
import { Coupon } from "../models/coupon.model.js";



// return all the coupons applicable for the cart
export const getApplicableCoupons = async function(userId, couponsUsed, cart) {


} 





export const applyCouponToCart = async function(coupon = null, cart = {}, userId) {
    // console.log({coupon, cart});
    // if (!coupon || !cart) {
    //     return 
    // }


    // verifyCoupon
    // console.log({coupon, totalPrice: cart.totalPrice});
    const {success: isCouponValid, coupon: verifiedCoupon} = await verifyCoupon(coupon, cart.totalPrice, userId);
    // console.log({isCouponValid});

    if (!isCouponValid) {
        return {isCouponValid, verifiedCoupon};
    }


    
    // calculate discount
    const couponDiscount = calculateCouponDiscount(verifiedCoupon, cart.totalPrice);
    // console.log({couponDiscount});

    if (!couponDiscount) {
        return {success: false, error: "Some error occured"};
    };

    const couponData = {
        couponId: verifiedCoupon._id,
        couponCode: verifiedCoupon.code,
        discount: couponDiscount
    };

    cart.couponInfo = {...couponData};
    cart.items.forEach(item => {
        item.couponInfo = {...couponData};
    });

    // console.log(cart);



    const cartWithCouponDistribution = distributeCouponDiscount (couponDiscount, cart);
    // console.log(cartWithCouponDistribution);

    return cartWithCouponDistribution;

}



// verify a specific coupon 
export const verifyCoupon = async function(couponInfo, cartValue, userId) {
    
    // @param couponInfo = {code, id}
    // @param cartValue = cart.totalPrice
    
    try {
        
        const user = await User.findById(
            userId,
            {couponsUsed: 1, _id: 0}
        );

        const couponsUsed = user.couponsUsed.map(item => item.coupon);
        // console.log({couponsUsed});
        
        const hasUsedCoupon = user.couponsUsed.some(item => {
            if (item.coupon) {
                return (item.coupon == couponInfo.code) && (item.couponId == couponInfo.id);
            }
            return item.couponId == couponInfo.id;
        });
        // console.log({hasUsedCoupon});

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
        return {success: false, error: err.message };
    }
} 



export const calculateCouponDiscount = function(verifiedCoupon, cartValue) {

    if (!verifiedCoupon) return cartValue;
    // console.log({verifiedCoupon, cartValue});
    let discount;
    if (verifiedCoupon.isPercent) {
        let percentDiscount = cartValue * (verifiedCoupon.couponAmount/100);
        discount = Math.min(percentDiscount, verifiedCoupon.maxDiscount);
    } else {
        discount = verifiedCoupon.couponAmount;
    }

    // const finalPrice = Math.max(1, Math.round(cartValue - discount));

    return discount;

};



export const distributeCouponDiscount = function(discount, cart) {
    cart.items.forEach(item => {
        const itemTotal = item.subtotal;
        const orderTotal = cart.totalPrice;
        const itemShare = Math.round((itemTotal / orderTotal) * discount);
        item.couponInfo.itemDiscount = itemShare;
        item.finalPrice = itemTotal - itemShare;
    });

    cart.totalPrice = cart.items.reduce((total, item) => total + item.finalPrice ,0);
    // cart.items.forEach(item => console.log(item.couponInfo));
    return cart;
}

