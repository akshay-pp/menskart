import {Router} from "express";
import {upload} from "../middlewares/multer.js";

const router = Router();


import {getAdmin, getUserList, blockUser, getCategories, createCateogry, editCateogry, getAddProduct, postAddProduct, unListcategory, getProductList, getEditProduct, unlistProduct}
from "../controllers/admin.controllers.js";

router.route("/dashboard").get(getAdmin);
router.route("/user-list").get(getUserList);
router.route("/category").get(getCategories).post(createCateogry);
router.route("/c/edit/:categoryId").put(editCateogry);
router.route("/c/unlist/:categoryId").post(unListcategory);
router.route("/u/block/:userId/:action?").post(blockUser)
router.route("/add-product").get(getAddProduct).post(upload.array('images'), postAddProduct);
router.route("/product-list").get(getProductList);
router.route("/p/edit/:pId").get(getEditProduct);
router.route("/p/edit/:pId/:action?").post(unlistProduct);

export default router;