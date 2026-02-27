import {User} from "../models/user.model.js";
import {Category} from "../models/category.model.js";
import {Product} from "../models/product.model.js";
import {Order} from "../models/order.model.js";
import {Coupon} from "../models/coupon.model.js";
import { Offer } from "../models/offer.model.js";
import {findBestPrice} from '../utils/calculateOfferPrice.js';
// import {Brand} from "../models/brand.model.js";


export const getAdmin = async(req,res) => {

    // if (req.session.user?.role === "admin"){

        try {

            const now = new Date();
            const nowForMonthly = new Date();
            const { start, end } = req.query;
            const interval = req.query.interval || "all-time";
            console.log(req.query);
            let fromDate = new Date("2024-03-25");
            switch (interval) {

                case 'daily':
                  fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  break;
              
                case 'weekly':
                  const day = now.getDay();
                  fromDate = new Date(now);
                  fromDate.setDate(now.getDate() - day);
                  fromDate.setHours(0, 0, 0, 0);
                  break;
              
                case 'monthly':
                  fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
                  break;
              
                case 'yearly':
                  fromDate = new Date(now.getFullYear(), 0, 1);
                  break;
              
                case 'custom':
                  fromDate = new Date(start);
                  now.setTime(new Date(end).getTime());
                  break;
                
                case 'all-time':
                    fromDate = new Date("2024-03-25"); 

            }

            console.log(fromDate)
            const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const latestOrders = await Order.find({}).sort({createdAt: -1}).populate('owner', 'fullname').limit(10);
            
            console.log("req.query:", req.query);
            console.log("Interval:", interval);
            console.log("Start:", start);
            console.log("End:", end);
            console.log("From Date:", fromDate.toISOString());
            console.log("Now:", now.toISOString()); 
            
            const thisMonthRevenue = await Order.aggregate([
                {
                    $match: {
                        createdAt: {$gte: firstDayThisMonth, $lte: nowForMonthly}
                    }
                },

                {
                    $group: {
                        _id: null,
                        thisMonthRevenue: {$sum: "$totalPrice"}
                    }
                }
            ]);

            const productSales = await Order.aggregate([
                
                {
                    $match: {
                      createdAt: { $gte: fromDate, $lte: now }
                    }
                },

                { $unwind: "$orderItems" },

                {
                  $group: {
                    _id: null,
                    productSales: { $sum: "$orderItems.quantity" }
                  }
                }

            ]);

            const totalRevenue = await Order.aggregate([
                
                {
                    $match: {
                      createdAt: { $gte: fromDate, $lte: now }
                    }
                },

                {
                  $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalPrice" }
                  }
                }

            ]);


            const totalOrders = await Order.aggregate([
                
                {
                    $match: {
                      createdAt: { $gte: fromDate, $lte: now }
                    }
                },

                {
                    $group: {
                        _id: null, 
                        totalOrders: { $sum: 1 }, 
                    }
                }

            ]);

            
            const data = { 

                thisMonthRevenue: thisMonthRevenue[0]?.thisMonthRevenue || 0,
                productSales: productSales[0]?.productSales || 0,
                totalRevenue: totalRevenue[0]?.totalRevenue || 0,
                totalOrders: totalOrders[0]?.totalOrders || 0

            };
            
            

            console.log(data);

            

            return res.status(200).render("index-admin", {user: req.session.user, data, latestOrders, interval, start, end});
    
        } catch (error) {
            console.error("Error fetching total sales and revenue:", error);
            return { totalSales: 0, totalRevenue: 0 };
        }
    // }else{
    //     res.redirect("/");
    // }
};


export const getUserList = async(req,res) => {

    if(req.session.user?.role === "admin"){
        const userdata = await User.find({}, {password:0, avatar:0, });
        res.status(200).render("admin-user-list", {userdata, user: req.session.user});
    }else{
        res.redirect("/");
    } 
};



export const blockUser = async(req,res) => {
    if (req.session.user?.role === "admin"){

        const {userId, action} = req.params;

        try {

            if(action){

                await User.findByIdAndUpdate(userId, { isBlocked: false } );

            }else{

                if(userId == req.session.user._id){
                    return res.status(400).json({success: false, error: "Cannot block yourself"});
                }
                await User.findByIdAndUpdate(userId, { isBlocked: true } );
            }

            return res.redirect("/api/admin/user-list")

        } catch (error) {

            return res.status(500).json({success:false, error:error.message});
        }
        
    }else{
        res.redirect("/");
    }
}







// ------------ category ------------ //


// get category list
export const getCategories = async(req,res) => {

    try{

        const categdata = await Category.find().populate("parent", "name");
        return res.status(200).render("admin-categories", {categdata, user: req.session.user});

    }catch(error){

        return res.status(500).json(error.message);
        
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
            return res.status(400).json({ success: false, error: "All fields are required" });
        }

        const existingCategory = await Category.find({name:categoryName}).collation({locale: 'en', strength: 2});
        if(existingCategory.length > 0){
            return res.status(400).json({success:false, error: "Category with that name already exists"});
        }

        try {
            const newCategory = await Category.create({name: categoryName, parent, description: categoryDescription});
            console.log(newCategory);
            return res.status(200).json({ success: true, message: "Created succesfully" });
        } catch (error) {
            res.status(500).json({success: false, error: error.message});
        }

    } else {
        res.status(400).json({success:false, error: "Area 51, Unauthorized"});
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
            return res.status(400).json({ success: false, error: "All fields are required" });
        }

        try {
            
            const existingCategory = await Category.find({name:editCategoryName}).collation({locale: 'en', strength: 2});

            if(existingCategory.length > 0){
                return res.status(400).json({success:false, error: "Category with that name already exists"});
            }

            const category = await Category.findById(categoryId);
            
            if(!category){
                return res.status(400).json({ success:false, error: "Category not found"});
            }
            
            category.name = editCategoryName;
            category.parent = editParentCategory === "null" ? null : editParentCategory ;
            category.description = editCategoryDescription;
            await category.save();
            const updatedCategory = await Category.findById(category._id);
            console.log(updatedCategory);

            return res.status(200).json({ success:true, message:"Details updated successfully"});


        } catch (error) {
            
            return res.status(500).json({ success:false, error: error.message });

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
                return res.status(400).json({ success:false, error: "Category not found" })
            }

            if (req.body.payload == "To List"){
                category.isUnListed = false;
            }else{
                category.isUnListed = true;
            }

            await category.save();
            const updatedCategory = await Category.findById(category._id);
            console.log(updatedCategory);
            return res.status(200).json({ success:true, message:"Updated successfully"});


        } catch (error) {
            return res.status(500).json({ success:false, error: error.message });
        }

        
    } else {
        res.redirect("/");
    }
}



//---------------------- orders --------------------//

export const getOrders = async(req,res) => {

    // if (req.session.user?.role === "admin"){

        try {

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page-1) * limit;
    
            const totalOrders = await Order.countDocuments();
            const totalPages = Math.ceil(totalOrders/limit);
            const orders = await Order.find({}).sort({createdAt: -1}).populate('owner', 'fullname').populate('address', 'city state').skip(skip).limit(limit);
            return res.status(200).render("admin-orders", {orders, page, totalPages});

        } catch (error) {

            return res.status(500).json({success: false, error: error.message});
        }

    // }else{
    //     res.redirect("/");
    // }
}



export const getOrderDetails = async(req,res) => {

    // if (req.session.user?.role === "admin"){

        const {orderId} = req.params;

        try {

            const order = await Order.findById(orderId).populate('owner', 'fullname email phone').populate('orderItems.product').populate('address')
            return res.status(200).render("admin-order-detail", {order});

        } catch (error) {

            return res.status(500).json({success: false, error: error.message});
        }

    // }else{
    //     res.redirect("/");
    // }

}

export const changeOrderStatus = async (req, res) => {

    const {orderId, itemId} = req.params;
    console.log({orderId, itemId, body: req.body});

    try {
        
        const order = await Order.findById(orderId);
        const item = order.orderItems.id(itemId);
        let updateObject = {};
        let trackRecord = {};
        console.log({order, item, status: item.status});

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

            if (req.body.returnStatus == "refunded") {
                
            }
            return;
        };

        
        if(req.body.status) {

            if (item.status === "delivered"){
                return res.status(400).json({success: false, error: "Item already delivered. cannot change status"});
            };

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

        if(result.matchedCount === 0) {
            return res.status(400).json({success: false, error: "Order or item not found"});
        };

        //update orderStatus with recalculateOrderStatus();

        return res.status(200).json({success: true, message: "Order status changed", orderStatus: req.body.status});

    } catch (error) {
        return res.status(500).json({success: false, error: error.message});
    }
};


export const changeReturnStatus = async(req, res) => {

}




// ------------ product ------------ //


//get product list
export const getProductList = async (req,res) => {

    // if (req.session.user?.role === "admin") {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 5;
    
            const totalProducts = await Product.countDocuments();
            const totalPages = Math.ceil(totalProducts/limit);
    
            const productdata = await Product.find({}).populate("category", "name").skip((page-1)*limit).limit(limit);
            return res.status(200).render("admin-products-list", {productdata, page, totalPages, user: req.session.user});
        } catch (error) {
            return res.status(500).json({success: false, error: "Error fetching products"});
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
            const limit = parseInt(req.query.limit) || 5;
    
            const totalProducts = await Product.countDocuments();
            const totalPages = Math.ceil(totalProducts/limit);
    
            const productdata = await Product.find({}).populate("category", "name").skip((page-1)*limit).limit(limit);
            return res.status(200).render("admin-inventory", {productdata, page, totalPages, user: req.session.user});
        } catch (error) {
            return res.status(500).json({success: false, error: "Error fetching products"});
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
            return res.status(400).json({success: false, error: "Product doesnt exist"});
        }

        if(quantity <= 0 || isNaN(quantity)){
            return res.status(400).json({success: false, error: "Enter a valid quantity value"});
        }

        product.stock += quantity;
        await product.save();

        return res.status(200).json({success: true, message: "Stock updated successfully", stock: product.stock});

    } catch (error) {

        return res.status(500).json({success: false, error: error.message}); 

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
    res.status(200).render("admin-edit-product", {product, categdata, user: req.session.user});
}



// get add product page
export const getAddProduct = async (req,res) => {

    if (req.session.user?.role !== "admin") {
        return res.redirect("/");
    }
    const categdata = await Category.find({}); 
    return res.status(200).render("admin-add-product", {user: req.session.user, categdata});
}


// add new product
export const postAddProduct = async (req,res) => {
    
    if (req.session.user?.role !== "admin") {
        return res.redirect("/");
    }

    const product = req.body;
    const files = req.files;

    console.log(files);
    
    if(req.files.length < 3) {
        return res.status(400).json({success: false, error: "Minimum 3 images neeeded"});
    }


    const images = files.map(file => file.path.replace(/\\/g, '/')); 
    
    try {
        
        const newProduct = await Product.create({...product, images});

        console.log(newProduct);
        return res.status(200).json({success: true, message: "Product added successfully", newProduct});
    
    } catch (error) {
        return res.status(500).json({success: false, error});
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

        return res.status(500).json({success:false, error:error.message});
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
        return res.status(200).json({success:true, message: "Image deleted successfully"});
    } catch (error) {
        return res.status(500).json({success:false, error: error.message});
    }

}



//coupons

export const getCoupons = async (req, res) => {

    const coupons = await Coupon.find({}).sort({createdAt:-1});
    console.log(req.path);
    return res.status(200).render("coupons", {coupons});
    
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
            return res.status(400).json({success: false, error});
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
            return res.status(409).json({success:false, message: "An active coupon with the same name exists"});
        }
        

        const coupon = new Coupon({

            name: couponName,
            code: couponCode?.toUpperCase(),
            description: coupondescription,
            isPercent,
            couponAmount: discountAmount,
            minimumCartValue: minimumValue,
            maxDiscount,
            validFrom: couponStartDate,
            expiry: couponExpiryDate

        });

        await coupon.save();
        const newCoupon = await Coupon.findById(coupon._id);
        console.log(JSON.stringify(newCoupon, null, 2));

        return res.status(200).json({success: true, message: "Coupon created successfully"})

    } catch(err) {
        return res.status(500).json({success: false, error: err.message});
    }

}



//offer operations
export const getOffers = async(req, res) => {

    //fetch needed data from db
    const categories = await Category.find({isUnListed: false}, {name: 1});
    const offers = await Offer.find({}).sort({createdAt: -1});
    return res.render('offers', {categories, offers});
    
}


export const createOffer = async(req, res) => {

    try {

        console.log(req.body);
        //validations

        const isPercent = req.body.productOfferIsPercentage ? true : false;
        const offer = new Offer({
            name: req.body.productOfferName,
            type: req.body.type,
            appliesTo: req.body.appliesTo ?? null ,
            productIds: req.body.productId ?? null,
            offerAmount: req.body.productOfferAmount,
            maxDiscount: isPercent ? req.body.productOfferMaxDiscount : null,
            description: req.body.productOfferDescription,
            minimumValue: req.body.productOfferMinimumValue,
            validFrom: req.body.productOfferStartDate,
            expiry: req.body.productOfferExpiryDate,
            isPercent
        });

        console.log(offer);

        await offer.save();
        return res.status(201).json({success: true, message: "Offer created successfully"});


    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, error: err.message});
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
        return res.status(201).json({success: true, message: "Changes applied successfully"});


    } catch(err) {
        console.log(err);
        return res.status(500).json({success: false, error: err.message});
    }
    
}



export const changeOfferStat = async(req,res) => {
    
    console.log({body: req.body, params: req.params});
    const {offerId} = req.params;
        
    try { 
            
        const offer = await Offer.findById(offerId);
            
        if(!offerId){
            return res.status(400).json({ success:false, error: "Offer not found" })
        }

        if (req.body.payload == "Deactivate"){
            offer.isActive = false;
        }else{
            offer.isActive = true;
        }
        
        await offer.save();
        const updatedOffer = await Offer.findById(offer._id);
        console.log(updatedOffer);
        return res.status(200).json({ success:true, message:"Updated successfully"});

    } catch (error) {
        return res.status(500).json({ success:false, error: error.message });
    }

}


export const getReturns = async (req,res) => {

    try {
        
        const ordersInReturnRequests = await Order.aggregate([
            {$unwind: "$orderItems"},
            {$match: {"orderItems.returnStatus" : "requested"}},
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
            {$project: {
                username: 1, productData: 1, orderItems: 1, 
            }},
            {$sort: {'orderItems.deliveredAt': -1}}
        ])

        console.log({sampleFullOrder: ordersInReturnRequests[0], sampleOrderItem: ordersInReturnRequests[0].orderItems, username: ordersInReturnRequests[0].username, productData: ordersInReturnRequests[0].productData });
        return res.status(200).render("admin-returns", {ordersInReturnRequests});


    } catch (error) {
        return res.status(500).json({success: false, error});
    }

}


export const exprApi = async (req, res) => {

    try {
        const products = await Product.find({}).limit(5).lean();
        // console.log(products);
        const productsWithOfferApplied = findBestPrice(...products);
        return res.status(200).json(productsWithOfferApplied);
    } catch (err) {
        return res.status(500).json({success: false, error: err.message});
    }

}