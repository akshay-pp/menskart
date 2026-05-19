import {User} from "../models/user.model.js";
import {Category} from "../models/category.model.js";
import {Product} from "../models/product.model.js";
import {Order} from "../models/order.model.js";
import {Coupon} from "../models/coupon.model.js";
import { Offer } from "../models/offer.model.js";
import { Wallet } from "../models/wallet.model.js";
import {findBestPrice} from '../utils/calculateOfferPrice.js';
import {generateOrderId} from '../utils/idGenerator.js';
import {paginate} from '../utils/paginate.js';
import {STATUS_CODES} from '../utils/constants/statusCodes.js';
import { PAGINATION_CONFIG } from "../utils/constants/config.js";
import { generateDashboardData } from "../utils/generateDashboardData.js";
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import {fileURLToPath} from 'url';
import {formatDate} from '../utils/formatDate.js';

// import {Brand} from "../models/brand.model.js";


export const getAdmin = async(req,res) => {

    // if (req.session.user?.role === "admin"){

        try {

            const dashboardData = await generateDashboardData(req.query);
            
            // console.log(data);

            // return res.status(STATUS_CODES.SUCCESS).json({user: req.session.user, data, latestOrders, interval, start, end});
            // return res.status(STATUS_CODES.SUCCESS).render("sales-report", {user: req.session.user, ...dashboardData});
            return res.status(STATUS_CODES.SUCCESS).render("index-admin", {user: req.session.user, ...dashboardData});
    
        } catch (error) {
            console.error("Error fetching total sales and revenue:", error);
            return { totalSales: 0, totalRevenue: 0 };
        }
    // }else{
    //     res.redirect("/");
    // }
};

export const generateSalesReport = async(req, res) => {
    console.log(req.query);
    const salesReportData = await generateDashboardData(req.query);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const htmlData = await ejs.renderFile(
        path.join(__dirname, '../views/sales-report.ejs'),
        {...salesReportData}
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
        'Content-Disposition' : `attachment; filename=sales-report-${req.query.interval}-${formatDate(new Date())}.pdf`,
        'Content-Length' : pdfData.length
    });

    return res.end(pdfData);
    
};


export const getUserList = async(req,res) => {

    if(req.session.user?.role === "admin"){
        const {data: userdata, pagination} = await paginate(User, {page: req.query.page, limit: PAGINATION_CONFIG.DEFAULT_LIMIT, sort: 'newestFirst'});
        const {totalPages, currentPage} = pagination;
        res.status(STATUS_CODES.SUCCESS).render("admin-user-list", {userdata, pagination, totalPages, currentPage, user: req.session.user});
    } else {
        res.redirect("/");
    } 
};



export const blockUser = async(req,res) => {
    if (req.session.user?.role === "admin"){

        const {userId, action} = req.params;

        try {

            if(action){
                await User.findByIdAndUpdate(userId, { isBlocked: false } );
            } else {
                if(userId == req.session.user._id){
                    return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Cannot block yourself"});
                }
                await User.findByIdAndUpdate(userId, { isBlocked: true } );
            }

            return res.redirect("/api/admin/user-list")

        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error:error.message});
        }
        
    } else {
        res.redirect("/");
    }
}





// ------------ category ------------ //


// get category list
export const getCategories = async(req,res) => {

    try{
        const categdata = await Category.find().populate("parent", "name");
        return res.status(STATUS_CODES.SUCCESS).render("admin-categories", {categdata, user: req.session.user});
    } catch (error){
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json(error.message);
    }

}



// create category
export const createCateogry = async(req,res) => {
    if (req.session.user?.role === "admin") {
        
        console.log(req.body);
        const {categoryName, parentCategory, categoryDescription} = req.body;
        const parent = parentCategory === "null" ? null : parentCategory ;

        let isEmpty = [categoryName, parent, categoryDescription].some(item => item?.trim() === "")

        if (isEmpty){
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "All fields are required" });
        }

        const existingCategory = await Category.find({name:categoryName}).collation({locale: 'en', strength: 2});
        if(existingCategory.length > 0){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "Category with that name already exists"});
        }

        try {
            const newCategory = await Category.create({name: categoryName, parent, description: categoryDescription});
            console.log(newCategory);
            return res.status(STATUS_CODES.SUCCESS).json({ success: true, message: "Created succesfully" });
        } catch (error) {
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }

    } else {
        res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "Area 51, Unauthorized"});
    }
}



// edit category
export const editCateogry = async(req,res) => {

    const { categoryId } = req.params;
    const { editCategoryName, editParentCategory, editCategoryDescription } = req.body.payload;
    console.log({ editCategoryName, editParentCategory, editCategoryDescription });

    if(req.session.user?.role === "admin"){

        let isEmpty = [editCategoryName, editParentCategory, editCategoryDescription].some(item => item?.trim() === "")

        if (isEmpty){
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: "All fields are required" });
        }

        try {
            
            const existingCategory = await Category.find({name:editCategoryName}).collation({locale: 'en', strength: 2});

            if(existingCategory.length > 0){
                return res.status(STATUS_CODES.BAD_REQUEST).json({success:false, error: "Category with that name already exists"});
            }

            const category = await Category.findById(categoryId);
            
            if(!category){
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success:false, error: "Category not found"});
            }
            
            category.name = editCategoryName;
            category.parent = editParentCategory === "null" ? null : editParentCategory ;
            category.description = editCategoryDescription;
            await category.save();
            const updatedCategory = await Category.findById(category._id);
            console.log(updatedCategory);

            return res.status(STATUS_CODES.SUCCESS).json({ success:true, message:"Details updated successfully"});


        } catch (error) {
            
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success:false, error: error.message });

        }
    }else{
        return res.redirect("/");
    }

}


// unlist category
export const unListcategory = async(req,res) => {
    if (req.session.user?.role === "admin"){
        const {categoryId} = req.params;
        console.log(req.body);
        
        try {
            
            const category = await Category.findById(categoryId);

            if(!category){
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success:false, error: "Category not found" })
            }

            if (req.body.payload == "To List"){
                category.isUnListed = false;
            }else{
                category.isUnListed = true;
            }

            await category.save();
            const updatedCategory = await Category.findById(category._id);
            console.log(updatedCategory);
            return res.status(STATUS_CODES.SUCCESS).json({ success:true, message:"Updated successfully"});


        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success:false, error: error.message });
        }

        
    } else {
        res.redirect("/");
    }
}



//---------------------- orders --------------------//

export const getOrders = async(req,res) => {

    // if (req.session.user?.role === "admin"){

        try {


            // const shoesOrders = await Order.aggregate([
            //     {$unwind: "$orderItems"},
            //     {$lookup: {
            //         from: "product",
            //         localField: "orderItems.product",
            //         foreignField: "_id",
            //         as: "productData"
            //     }},
            //     {$unwind: "$productData"},
            //     {$match: {"productData.categoryName": "shoes"}},
            //     {$group: {_id: null, count: {$sum: 1}}}
            // ]);

            // console.log(shoesOrders);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const ordersToday = await Order.find({createdAt: {$gte: today, $lte: now}});
            console.log(ordersToday, `no. of orders: ${ordersToday.length}`);
            return;
            const populate = [
                {path: 'owner', select: 'fullname'},
                {path: 'address', select: 'city state'}
            ];

            const {data: orders, pagination} = await paginate(Order, {page: req.query.page, limit: PAGINATION_CONFIG.DEFAULT_LIMIT, sort: 'newestFirst', populate});
            const {totalPages, currentPage} = pagination;

            return res.status(STATUS_CODES.SUCCESS).render("admin-orders", {orders, pagination, currentPage, totalPages});

        } catch (error) {
            console.log(error);
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }

    // }else{
    //     res.redirect("/");
    // }
}



export const getOrderDetails = async(req,res) => {

    // if (req.session.user?.role === "admin"){

        const {orderId} = req.params;

        try {

            const order = await Order.findById(orderId).populate('owner', 'fullname email phone').populate('orderItems.product').populate('address').lean();

            const allowedAction = {
                created: [{value: 'confirmed', label: 'Confirmed'}, {value: 'cancelled', label: 'Cancelled'}], 
                confirmed: [{value: 'processing', label: 'Processing'}, {value: 'cancelled', label: 'Cancelled'}] , 
                processing: [{value: 'shipped', label: 'Shipped'}, {value: 'cancelled', label: 'Cancelled'}], 
                shipped: [{value: 'delivered', label: 'Delivered'}, {value: 'cancelled', label: 'Cancelled'}], 
                delivered: [],
                cancelled: []
            }

            order.orderItems.forEach(item => item.allowedAction = allowedAction[item.status]);
            console.log(order);
            return res.status(STATUS_CODES.SUCCESS).render("admin-order-detail", {order});

        } catch (error) {

            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }

    // }else{
    //     res.redirect("/");
    // }

}

export const changeOrderStatus = async (req, res) => {

    const allowedAction = {
        created: new Set(['confirmed', 'cancelled']), 
        confirmed: new Set(['processing', 'cancelled']) , 
        processing: new Set(['shipped', 'cancelled']), 
        shipped: new Set(['delivered', 'cancelled']), 
        delivered: new Set(), 
        cancelled: new Set()
    };

    const {orderId, itemId} = req.params;
    console.log({orderId, itemId, body: req.body});

    try {
        
        const order = await Order.findById(orderId);
        const item = order.orderItems.id(itemId);
        let updateObject = {};
        let trackRecord = {};
        // console.log({order, item, status: item.status, returnStatus: item.returnStatus});

        if (req.body.returnStatus) {

            trackRecord = {
                'orderItems.$.trackRecords' : {
                    status: `Return ${req.body.returnStatus}`,
                    date: new Date()
                }
            };

            updateObject = {
                'orderItems.$.returnStatus' : req.body.returnStatus
            };

            console.log(trackRecord, updateObject);

            //push to wallet as pending

            if (req.body.returnStatus == "refunded") {
                //fetch finalPrice from orderItem
                const amountToRefund = item.finalPrice ?? (item.price*item.quantity);
                const newTransaction = {
                    amount: amountToRefund,
                    direction: 'Credit',
                    source: 'refund',
                    relatedOrder: {
                        orderId,
                        itemId
                    },
                    refundType: 'return',
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
            // return;
        };

        
        if(req.body.status) {

            if(!allowedAction[item.status].size) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `Item status cannot be changed at this stage`});
            }

            if (item.status === "delivered"){
                return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Item already delivered. cannot change status"});
            };

            if(!allowedAction[item.status].has(req.body.status)) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: `${req.body.status} is not a valid choice`});
            }

            trackRecord = {
                'orderItems.$.trackRecords' : {
                    status: req.body.status,
                    date: new Date()
                }
            };

            if (req.body.status === 'delivered'){
                updateObject = {
                    'orderItems.$.status': req.body.status, 
                    'orderItems.$.deliveredAt' : new Date()
                }
            } else {
                updateObject = {
                    'orderItems.$.status': req.body.status
                };
            }
        }


        const result = await Order.updateOne(
            {_id: orderId, 'orderItems._id': itemId},
            {$set: updateObject, $push: trackRecord}
        );

        const updatedOrder = await Order.findById(orderId);
        const updatedItem = updatedOrder.orderItems.id(itemId);
        console.log('updated item \n', updatedItem);

        if(result.matchedCount === 0) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Order or item not found"});
        };

        //update orderStatus with recalculateOrderStatus();

        if(req.body.status) {
            return res.status(STATUS_CODES.SUCCESS).json({success: true, message: `Order status changed to: ${updatedItem.status.toUpperCase()}`, orderStatus: updatedItem.status});  
        }

        if (req.body.returnStatus) {
            return res.status(STATUS_CODES.SUCCESS).json({success: true, message: `Return status changed to: ${updatedItem.returnStatus.toUpperCase()}`, orderStatus: updatedItem.returnStatus});
        }

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
};


export const changeReturnStatus = async(req, res) => {

}




// ------------ product ------------ //


//get product list
export const getProductList = async (req,res) => {

    // if (req.session.user?.role === "admin") {
        try {

            const populate = [
                {path: 'category', select: 'name'}
            ];

            const {data: productdata, pagination} = await paginate(Product, {page: req.query.page, limit: PAGINATION_CONFIG.DEFAULT_LIMIT, sort: 'newestFirst', populate});
            const {totalPages, currentPage} = pagination;

            const productIds = productdata.map(item => item._id)
            const productOffers = await Offer.find({type: 'product', productIds: {$in: productIds}});
            const productOfferMap = new Map();
            productOffers.forEach(item => {
                productOfferMap.set(item.productIds.toString(), item);
            });

            productdata.forEach(item => {
                item.productOffer = productOfferMap.get(item._id.toString());
            });

            return res.status(STATUS_CODES.SUCCESS).render("admin-products-list", {productdata, pagination, currentPage, totalPages, user: req.session.user});
        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message || "Error fetching products"});
        }

    // } else {
    //     return res.redirect("/");
    // }

}



//get product list
export const getInventory = async (req,res) => {

    // if (req.session.user?.role === "admin") {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = PAGINATION_CONFIG.DEFAULT_LIMIT || parseInt(req.query.limit);
    
            const totalProducts = await Product.countDocuments();
            const totalPages = Math.ceil(totalProducts/limit);
    
            const productdata = await Product.find({}).populate("category", "name").skip((page-1)*limit).limit(limit);
            return res.status(STATUS_CODES.SUCCESS).render("admin-inventory", {productdata, page, totalPages, user: req.session.user});
        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: "Error fetching products"});
        }

    // } else {
    //     return res.redirect("/");
    // }

}


export const updateStock = async (req,res) => {

    const { productId } = req.params;
    const { stockQuantity } = req.body;
    
    const quantity = parseInt(stockQuantity);
    
    try {
        
        const product = await Product.findById(productId);

        if(!product){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Product doesnt exist"});
        }

        if(quantity <= 0 || isNaN(quantity)){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Enter a valid quantity value"});
        }

        product.stock += quantity;
        await product.save();

        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Stock updated successfully", stock: product.stock});

    } catch (error) {

        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message}); 

    }
}





//get edit product page 
export const getEditProduct = async(req,res) => {

    if (req.session.user?.role !== "admin") {
        return res.redirect("/");
    }

    const productId = req.params.pId;
    const product = await Product.findById(productId)
                                        .populate("category", "name")
                                        .populate("subcategory", "name");
    const categdata = await Category.find().populate("parent", "name");
    res.status(STATUS_CODES.SUCCESS).render("admin-edit-product", {product, categdata, user: req.session.user});
}



// get add product page
export const getAddProduct = async (req,res) => {

    if (req.session.user?.role !== "admin") {
        return res.redirect("/");
    }
    const categdata = await Category.find({}); 
    return res.status(STATUS_CODES.SUCCESS).render("admin-add-product", {user: req.session.user, categdata});
}


// add new product
export const postAddProduct = async (req,res) => {
    
    if (req.session.user?.role !== "admin") {
        return res.redirect("/");
    }

    const product = req.body;
    const files = req.files;
    const category = await Category.findById(req.body.category).select('name');


    console.log({files, product, category});
    
    if(req.files.length < 3) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "Minimum 3 images neeeded"});
    }


    const images = files.map(file => file.path.replace(/\\/g, '/')); 
    
    try {
        
        const newProduct = await Product.create({...product, images, categoryName: category.name});

        console.log(newProduct);
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Product added successfully", newProduct});
    
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error});
    }
}



//unlist-list product
export const unlistProduct = async (req,res) => {


    const {pId, action} = req.params;

    try {


        const product = await Product.findById(pId);

        if (product.isUnListed){
            product.isUnListed = false;
        } else {
            product.isUnListed = true;
        }

        await product.save();
        console.log(product);

        return res.redirect("/api/admin/product-list");

    } catch (error) {

        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error:error.message});
    }

}



//remove product image

export const deleteImage = async (req,res) => {

    const {productId, image} = req.body;

    try {
        const product = await Product.findByIdAndUpdate(productId, {$pull : {images: image}}, { new: true });
        console.log(product);
        if (!product){
            return res.json({success:false, error: "Error deleting the image"});
        }
        return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "Image deleted successfully"});
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error: error.message});
    }

}



//coupons

export const getCoupons = async (req, res) => {

    const {data: coupons, pagination} = await paginate(Coupon, {page: req.query.page, limit: PAGINATION_CONFIG.DEFAULT_LIMIT, sort: 'newestFirst'});
    const {totalPages, currentPage} = pagination;
    console.log(req.path);
    return res.status(STATUS_CODES.SUCCESS).render("coupons", {coupons, pagination, totalPages, currentPage});
    
}



export const createCoupon = async(req,res) => {

    try {

        console.log(req.body);
    
        const validateFields = function() {
            
            let errors = {};

            if (!req.body || !(Object.keys(req.body).length)) {
                console.log("Empty req.body ✅")
                return { isValid: false, error: "Invalid request body" };
            };

            // check if any empty field exist 
            Object.entries(req.body).forEach(([key, value]) => {
                
                if ( value == null || (typeof value === "string" && value.trim() === "") ) {
                    if(key == "maxDiscount" && !req.body.isPercentage) return
                    errors[key] = "Field is required";
                } 

            });

            
            [req.body.couponCode, req.body.couponName].forEach((value, index) => {
                
                let field = index === 0 ? "couponCode" : "couponName";
                
                if (value.trim().length < 6) {
                    errors[field] = "Minimum 6 characters";
                } else if (value.trim().length > 15) {
                    errors[field] = "Maximum 15 characters";
                }
    
            });



            if (req.body.isPercentage) {
                    
                if ( req.body.discountAmount && (Number(req.body.discountAmount.trim()) > 100 || Number(req.body.discountAmount.trim()) < 0) ) {
                    errors.discountAmount = "Invalid Percentage Value!";
                }

                if ( req.body.minimumValue && req.body.maxDiscount && (Number(req.body.minimumValue.trim()) <= Number(req.body.maxDiscount.trim())) ) {
                    errors.minimumValue = errors.maxDiscount = "Maximum discount cannot exceed minimum cart value!";
                }

            } else {

                if (req.body.discountAmount && req.body.minimumValue && (Number(req.body.discountAmount.trim()) >= Number(req.body.minimumValue.trim())) ) {
                    errors.discountAmount = errors.minimumValue = "Discount cannot exceed minimum cart value!";
                }

            }


            if (req.body.couponStartDate && req.body.couponExpiryDate && new Date (req.body.couponExpiryDate) < new Date (req.body.couponStartDate)) {
                errors.couponStartDate = errors.couponExpiryDate = "Coupon start date cannot be greater than expiry date";
            }


            if (Object.keys(errors).length) {
                return {isValid: false, error: errors};
            } else {
                return {isValid: true};
            }

        }

        const {isValid, error} = validateFields();
        console.log("validateFields worked ✅")

        if (!isValid) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error});
        }


        //======== Field References ========//

        const {
            couponName, 
            couponCode, 
            isPercentage, 
            discountAmount, 
            maxDiscount, 
            minimumValue, 
            couponStartDate, 
            couponExpiryDate, 
            coupondescription
        } = req.body;

        const isPercent = isPercentage ? true : false;

        const regexedCode = new RegExp(`^${couponCode}$`, "i"); 
        console.log(regexedCode);
        const existingCoupon = await Coupon.find({
            code: regexedCode,
            expiry: {$gt: new Date()},
            couponActive: true
        });

        console.log({existingCoupon});

        if (existingCoupon.length) {
            return res.status(STATUS_CODES.CONFLICT).json({success:false, message: "An active coupon with the same name exists"});
        }
        

        const coupon = new Coupon({

            name: couponName,
            code: couponCode?.toUpperCase(),
            description: coupondescription,
            isPercent,
            couponAmount: discountAmount,
            minimumCartValue: minimumValue,
            maxDiscount: isPercent ? maxDiscount : null,
            validFrom: couponStartDate,
            expiry: couponExpiryDate

        });

        console.log(coupon);

        await coupon.save();
        const newCoupon = await Coupon.findById(coupon._id);
        console.log(JSON.stringify(newCoupon, null, 2));

        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Coupon created successfully"})

    } catch(err) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    }

}

export const changeCouponStat = async(req, res) => {

    console.log({body: req.body, params: req.params});
    const {couponId} = req.params;
        
    try { 
            
        const coupon = await Coupon.findById(couponId);
            
        if(!couponId){
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success:false, error: "Coupon not found" })
        }

        if (req.body.payload == "Deactivate"){
            coupon.couponActive = false;
        } else {
            coupon.couponActive = true;
        }
        
        await coupon.save();
        const updatedCoupon = await Coupon.findById(coupon._id);
        console.log(updatedCoupon);
        return res.status(STATUS_CODES.SUCCESS).json({ success:true, message:"Updated successfully"});

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success:false, error: error.message });
    }
};


export const editCoupon = async(req, res) => {

    try {

        console.log(req.body);
        //validations

        const isPercent = req.body.editIsPercentage ? true : false;
        const editCoupon = {
            name: req.body.editCouponName,
            code: req.body.editCouponCode,
            offerAmount: req.body.editCouponAmount,
            maxDiscount: isPercent ? req.body.editMaxDiscount : null,
            description: req.body.editCouponDescription,
            minimumValue: req.body.editMinimumValue,
            validFrom: req.body.editCouponStartDate,
            expiry: req.body.editCouponExpiry,
            isPercent
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(req.body._id, {$set: editCoupon}, {new: true});
        console.log(updatedCoupon);
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Changes applied successfully"});


    } catch(err) {
        console.log(err);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    }
};



//offer operations
export const getOffers = async(req, res) => {

    //fetch needed data from db
    const categories = await Category.find({isUnListed: false}, {name: 1});
    const {data: offers, pagination} = await paginate(Offer, {page: req.query.page, limit: PAGINATION_CONFIG.DEFAULT_LIMIT, sort: 'newestFirst'});
    const {currentPage, totalPages, totalDocs} = pagination;
    // return res.json({categories, offers, currentPage, totalPages});
    return res.render('offers', {categories, offers, pagination, currentPage, totalPages});
    
}


export const createOffer = async(req, res) => {

    try {

        console.log({body: req.body});
        //validations

        const isPercent = req.body.isPercentage ? true : false;
        const offer = new Offer({
            name: req.body.offerName,
            type: req.body.type,
            appliesTo: req.body.appliesTo ?? null ,
            productIds: req.body.productId ?? null,
            offerAmount: req.body.offerAmount,
            maxDiscount: isPercent ? req.body.maxDiscount : null,
            description: req.body.offerdescription,
            minimumValue: req.body.type == 'product' ? null : req.body.minimumValue,
            validFrom: req.body.offerStartDate,
            expiry: req.body.offerExpiry,
            isPercent
        });

        console.log({offer});

        await offer.save();
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Offer created successfully"});


    } catch(err) {
        console.log(err);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    }
    
}


export const editOffer = async(req, res) => {

    try {

        console.log(req.body);
        //validations

        const isPercent = req.body.editIsPercentage ? true : false;
        const editOffer = {
            name: req.body.editOfferName,
            type: req.body.type,
            appliesTo: req.body.editAppliesTo,
            offerAmount: req.body.editOfferAmount,
            maxDiscount: isPercent ? req.body.editMaxDiscount : null,
            description: req.body.editOfferDescription,
            minimumValue: req.body.editMinimumValue,
            validFrom: req.body.editOfferStartDate,
            expiry: req.body.editOfferExpiry,
            isPercent
        }

        const updatedOffer = await Offer.findByIdAndUpdate(req.body._id, {$set: editOffer}, {new: true});
        console.log(updatedOffer);
        return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Changes applied successfully"});


    } catch(err) {
        console.log(err);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    }
    
}



export const changeOfferStat = async(req,res) => {
    
    console.log({body: req.body, params: req.params});
    const {offerId} = req.params;
        
    try { 
            
        const offer = await Offer.findById(offerId);
            
        if(!offerId){
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success:false, error: "Offer not found" })
        }

        if (req.body.payload == "Deactivate"){
            offer.isActive = false;
        }else{
            offer.isActive = true;
        }
        
        await offer.save();
        const updatedOffer = await Offer.findById(offer._id);
        console.log(updatedOffer);
        return res.status(STATUS_CODES.SUCCESS).json({ success:true, message:"Updated successfully"});

    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success:false, error: error.message });
    }

}


export const getReturns = async (req,res) => {

    try {
        
        const ordersInReturnRequests = await Order.aggregate([
            {$unwind: "$orderItems"},
            {$match: {"orderItems.returnStatus" : {$ne: 'none'}}},
            {$lookup: {
                from: "users",
                let: {userId:'$owner'},
                pipeline: [
                    {$match: {
                        $expr: {$eq: ['$_id', '$$userId']}
                    }},
                    {$project: {
                        _id:0,
                        fullname: 1
                    }}
                ],
                as: "username"
            }},

            {$lookup: {
                from: "products",
                let: {productId: '$orderItems.product'},
                pipeline: [
                    {$match: {
                        $expr: {$eq: ['$_id', '$$productId']}
                    }},
                    {$project: {
                        _id:0,
                        productname: 1,
                        thumbnail: {$arrayElemAt: ['$images', 0]}
                    }}
                ],
                as: 'productData'
            }},
            {$unwind: "$productData"},
            {$unwind: "$username"},
            {$addFields: {
                    returnStatusOrder: {
                        $indexOfArray: [
                            ["requested", "approved", "rejected", "refunded"],
                            "$orderItems.returnStatus"
                        ]
                    }
                }
            },
            {$sort: {returnStatusOrder: 1,'orderItems.deliveredAt': -1}},
            {$project: {
                username: 1, productData: 1, orderItems: 1, 
            }}
        ]);

        ordersInReturnRequests.forEach(item => {
            const states = {
                requested: {label: "Review Request", badgeClass: 'alert-warning'}, 
                approved: {label: "Issue Refund", badgeClass: 'alert-info'},
                rejected: {label: "Reopen request", badgeClass: 'alert-danger'},
                refunded: {label: "Reopen request", badgeClass: 'alert-success'}
            } 
            item.uiData = states[item.orderItems.returnStatus];
        })

        // console.log(ordersInReturnRequests);
        return res.status(STATUS_CODES.SUCCESS).render("admin-returns", {ordersInReturnRequests});


    } catch (err) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    }

}


export const exprApi = async (req, res) => {

    try {
        const products = await Product.find({}).populate('category');
        for (const product of products) {
            if (product.category && product.category.name) {
                product.categoryName = product.category.name;
                await product.save();
            }
        };

        const updatedProducts = await Product.find({});
        return res.status(STATUS_CODES.SUCCESS).json({updatedProducts});
    } catch (err) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: err.message});
    }

}