import {Router} from "express";
const router = Router();

// import {
//         getHome,
//         getLogin, 
//         loginUser, 
//         registerUser, 
//         verifyRegistration, 
//         resendOtp, 
//         forgotPassword,
//         verifyForgotOtp,
//         resetPassword,
//         logoutUser
// } from "../controllers/auth.controllers.js";

// import {
//         getProfile,
//         editProfileName,
//         editPhone,
//         editEmail,
//         confirmEmail,
//         addAddress,
//         deleteAddress,
//         editAddress
// } from "../controllers/profile.controllers.js";

// import {
//         getProducts,
//         getProductPage
// } from "../controllers/product.controllers.js";

// import {
//         getWishlist,
//         addToWishlist,
//         removeFromWishlist
// } from "../controllers/wishlist.controllers.js";

// import {
//         getCart,
//         addToCart,
//         removeFromCart,
//         updateQuantity
// } from "../controllers/cart.controllers.js";

// import {
//         getCheckout,
//         createOrder,
//         orderStatus,
//         cancelOrder,
//         returnOrder,
//         getOrder,
//         generateInvoice
// } from "../controllers/order.controllers.js";

// import {
//         isCouponValid
// } from "../controllers/coupon.controllers.js";

// import {
//         verifyRazorpayPayment,
//         handleRazorpayPaymentFailure
// } from "../controllers/payment.controllers.js";


import {
        getHome,
        getLogin,
        loginUser,
        registerUser,
        verifyRegistration,
        resendOtp,
        forgotPassword,
        verifyForgotOtp,
        resetPassword,
        logoutUser,
        getProfile,
        editProfileName,
        editPhone,
        editEmail,
        confirmEmail,
        addAddress,
        deleteAddress,
        editAddress,
        getProducts,
        getProductPage,
        getWishlist,
        addToWishlist,
        removeFromWishlist,
        getCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        getCheckout,
        createOrder,
        orderStatus,
        cancelOrder,
        returnOrder,
        getOrder,
        generateInvoice,
        isCouponValid,
        verifyRazorpayPayment,
        handleRazorpayPaymentFailure,
        retryRazorpayPayment
}
from "../controllers/user.controllers.js";

import { userVerify } from "../middlewares/authVerify.js";


//authentication routes
router.route("/").get(getHome)
router.route("/login").get(getLogin).post(loginUser);
router.route("/register").get().post(registerUser);

router.route("/forgot-password/request-otp").post(forgotPassword);
router.route("/forgot-password/verify-otp").post(verifyForgotOtp);
router.route("/forgot-password/reset-password").patch(resetPassword);

router.route("/resend-otp").post(resendOtp);
router.route("/verify-registration").post(verifyRegistration);
router.post("/logout", logoutUser);


router.route("/products").get(getProducts);
router.route("/products/:pId").get(getProductPage);

//user profile routes
router.route("/profile/:tab?").get(userVerify, getProfile);
router.route("/profile/edit/name").patch(editProfileName);
router.route("/profile/edit/phone").patch(editPhone);
router.route("/profile/edit/email").post(editEmail);
router.route("/profile/edit/email").patch(confirmEmail);
router.route("/profile/add-address").post(addAddress);
router.route("/profile/edit-address").put(editAddress);
router.route("/profile/delete-address/:addressId").post(deleteAddress);

router.route("/cart").get(userVerify, getCart).post(userVerify, addToCart).delete(userVerify, removeFromCart);
router.patch("/cart/item/:itemId", updateQuantity);

router.route("/checkout").get(userVerify, getCheckout).post(userVerify, createOrder);

router.route("/wishlist").get(userVerify, getWishlist)
router.route("/wishlist/:productId").post(userVerify, addToWishlist).delete(userVerify, removeFromWishlist);

router.patch("/order/:orderId/item/:itemId/cancel", userVerify, cancelOrder);
router.patch("/order/:orderId/item/:itemId/return", userVerify, returnOrder);
router.route("/order/:orderId/item/:itemId").get(userVerify, getOrder);
router.get("/order/:orderId/item/:itemId/invoice", generateInvoice);
router.get("/order-confirmation", orderStatus);
// router.post('/apply-coupon', applyCoupon);
router.post('/coupon/is-valid', isCouponValid);
router.post('/payments/razorpay/verify', verifyRazorpayPayment);
router.post('/payments/razorpay/failure', handleRazorpayPaymentFailure);
router.post('/payments/razorpay/retry', retryRazorpayPayment);



// router.get(`/invoice`, generateInvoice);

export default router
