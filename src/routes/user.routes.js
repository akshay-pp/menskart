import {Router} from "express";


const router = Router();

import {getHome,
        loginUser,
        registerUser,
        verifyRegistration,
        logoutUser,
        resendOtp,
        getProducts,
        getProductPage}
from "../controllers/user.controllers.js";


//authentication routes
router.route("/").get(getHome)
router.route("/login").get().post(loginUser);
router.route("/register").get().post(registerUser);
router.route("/resend-otp").post(resendOtp);
router.route("/verify-registration").post(verifyRegistration)
router.post("/logout", logoutUser);
router.route("/products").get(getProducts);
router.route("/products/:pId").get(getProductPage);

//user profile routes
router.route("/profile").get().put();
router.route("/address").get().post();
router.route("/wishlist");
router.route("/orders");
router.route("/order/:orderId").get();
router.route("/cart");


export default router
