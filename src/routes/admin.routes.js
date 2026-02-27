import {Router} from "express";
import {upload} from "../middlewares/multer.js";

const router = Router();


import {getAdmin,
    getUserList,
    blockUser,
    getCategories,
    createCateogry,
    editCateogry,
    getAddProduct,
    postAddProduct,
    unListcategory,
    getProductList,
    getInventory,
    updateStock,
    getEditProduct,
    unlistProduct,
    deleteImage,
    getOrders,
    getOrderDetails,
    changeOrderStatus,
    getCoupons,
    createCoupon,
    getOffers,
    createOffer,
    editOffer,
    changeOfferStat,
    getReturns,
    exprApi}
from "../controllers/admin.controllers.js";

router.route("/dashboard").get(getAdmin);
router.route("/user-list").get(getUserList);
router.route("/category").get(getCategories).post(createCateogry);
router.route("/c/edit/:categoryId").put(editCateogry);
router.route("/c/unlist/:categoryId").post(unListcategory);
router.route("/u/block/:userId/:action?").post(blockUser)
router.route("/add-product").get(getAddProduct).post(upload.array('images'), postAddProduct);
router.route("/product-list").get(getProductList);
router.route("/inventory").get(getInventory);
router.route("/coupons").get(getCoupons).post(createCoupon);
router.route("/product/:productId/update-stock").patch(updateStock);
router.route("/p/edit/:pId").get(getEditProduct);
router.route("/p/edit/:pId/:action?").post(unlistProduct);
router.route("/image/delete").patch(deleteImage);
router.route("/orders").get(getOrders);
router.route("/orders/:orderId").get(getOrderDetails);
router.route("/orders/:orderId/item/:itemId").patch(changeOrderStatus);
router.route('/offers').get(getOffers).post(createOffer).patch(editOffer);
router.route("/offers/unlist/:offerId").post(changeOfferStat);
router.route("/returns").get(getReturns);

router.route('/expr').get(exprApi);


export default router;