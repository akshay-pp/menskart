import {User} from "../models/user.model.js";
import {Category} from "../models/category.model.js";
import {Product} from "../models/product.model.js";
// import {Brand} from "../models/brand.model.js";


export const getAdmin = async(req,res) => {

    if (req.session.user?.role === "admin"){
        res.status(200).render("index-admin", {user: req.session.user});
    }else{
        res.redirect("/");
    }
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

    if(req.session.user?.role === "admin"){
        const categdata = await Category.find().populate("parent", "name");
        return res.status(200).render("admin-categories", {categdata, user: req.session.user});
    }else{
        res.redirect("/");
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

        const existingCategory = await Category.find({name:categoryName});
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
            
            const existingCategory = await Category.find({name:editCategoryName});

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
        res.redirect("/");
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

        
    }else{
        res.redirect("/");
    }
}








// ------------ product ------------ //


//get product list
export const getProductList = async (req,res) => {

    // if (req.session.user?.role === "admin") {

        const productdata = await Product.find({}).populate("category", "name");
        return res.status(200).render("admin-products-list", {productdata, user: req.session.user});

    // } else {
    //     return res.redirect("/");
    // }

}


//get edit product page 
export const getEditProduct = async(req,res) => {
    const productId = req.params.pId;
    const product = await Product.findById(productId)
                                        .populate("category", "name")
                                        .populate("subcategory", "name");
    console.log(product);
    const categdata = await Category.find().populate("parent", "name");
    res.status(200).render("admin-edit-product", {product, categdata, user: req.session.user});
}



// get add product page
export const getAddProduct = async (req,res) => {
    const categdata = await Category.find({}); 
    return res.status(200).render("admin-add-product", {user: req.session.user, categdata});
}


// add new product
export const postAddProduct = async (req,res) => {
    
    const product = req.body;
    const files = req.files;
    
    if(req.files.length < 3) {
        return res.status(400).json({success: false, error: "Minimum 3 images neeeded"});
    }


    const images = files.map(file => file.path.replace(/\\/g, '/')); 
    console.log('Product Data:', product);
    console.log('Uploaded Images:', images); 
    
    try {
        
        const newProduct = await Product.create({...product, images});

        console.log(newProduct);
        return res.status(200).json({success: true, message: "product created successfully", newProduct});
    
    } catch (error) {
        return res.status(500).json({success: false, error});
    }
}



//unlist-list product

export const unlistProduct = async (req,res) => {

    if (req.session.user?.role === "admin"){

        const {pId, action} = req.params;

        try {


            const product = await Product.findById(pId);
            console.log(product);

            if (product.isUnListed){
                product.isUnListed = false;
            }else{
                product.isUnListed = true;
            }

            await product.save();
            console.log(product);
            
            

            return res.redirect("/api/admin/product-list");

        } catch (error) {

            return res.status(500).json({success:false, error:error.message});
        }
        
    }else{
        res.redirect("/");
    }

}