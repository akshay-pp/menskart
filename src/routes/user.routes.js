import {Router} from "express";

const router = Router();

import {getHome,
        getLogin,
        getProfile,
        editProfileName,
        editPhone,
        editEmail,
        confirmEmail,
        loginUser,
        registerUser,
        verifyRegistration,
        logoutUser,
        resendOtp,
        getProducts,
        getProductPage,
        addAddress,
        deleteAddress,
        editAddress,
        forgotPassword,
        verifyForgotOtp,
        resetPassword,
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
        isCouponValid,
        verifyRazorpay,
        generateInvoice}
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
router.route("/verify-registration").post(verifyRegistration)
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
router.post('/verify-razorpay-payment', verifyRazorpay)



// router.get(`/invoice`, generateInvoice);

export default router
