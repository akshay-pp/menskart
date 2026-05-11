import { Product } from "../models/product.model";
import {Category} from "../models/category.model.js";
import { Wishlist } from "../models/wishlist.model";
import { findBestPrice } from "../utils/calculateOfferPrice";
import { STATUS_CODES } from "../utils/constants/statusCodes";
import { PAGINATION_CONFIG } from "../utils/constants/config.js";
import {paginate} from '../utils/paginate.js';






//list products
export const getProducts = async(req,res) => {
    
    try {

        //category filter
        const categoryArray = [].concat(req.query.category || []);
        let categoryIdArray = [];

        console.log({categoryArray});

        let filter = {
            isUnListed: false,
            stock: {$gt: 0},
        };

        if (Array.isArray(categoryArray) && categoryArray.length) {
            try {
                const categoryIds = await Promise.all(categoryArray.map(category => Category.findOne({name: category}, '_id')));
                categoryIdArray = categoryIds.map(item => item._id);
                filter.category = {$in: categoryIdArray};
            } catch (err) {
                if (err) {
                    return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: err.message});
                }
            }
        }

        let populate = [
            { path: 'category',select: 'name _id' }
        ];
        
        const options = {
            page: req.query.page,
            limit: req.query.limit || PAGINATION_CONFIG.DEFAULT_LIMIT,
            sort: req.query.sort,
            filters: filter,
            populate, 
        };
        console.log(options);
        const {data: productdata, pagination, sort} = await paginate(Product, options); 



        //categories and no of products in each category
        const categoryData = await Product.aggregate([

            {
                $group : {
                    _id: '$category',
                    count: {$sum:1}
                }
            },

            {
                $lookup : {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },

            {
                $unwind: '$categoryDetails'
            }

        ]);

        // console.log('category query success ✅')

        
        
        let wishlist, wishlistSet; 
        if (req.session?.user?._id) {
            wishlist = await Wishlist.findOne({owner: req.session.user._id}).lean();
            wishlistSet = new Set(wishlist?.products?.map(id => id.toString()));
        }

        // console.log('wishlist query done ✅')



        
        // ------------- offer fetching and calculations 
        const productDataWithOffer = await findBestPrice(...productdata);

        const finalProductData = productDataWithOffer.map(product => {
            const isWishlisted = wishlist ? wishlistSet.has(product._id.toString()) : false;
            return {...product, isWishlisted};
        })

        console.log({finalProductData});


        const categData = categoryData.map(category => {
            return {category: category.categoryDetails.name, count: category.count}
        });

        // console.log('final categData success ✅')
        
        // return res.status(STATUS_CODES.SUCCESS).json({finalProductData, pagination, page: pagination.currentPage, totalPages: pagination.totalPages, sort, categData, categoryArray});
        return res.status(STATUS_CODES.SUCCESS).render('user-product-list', {finalProductData, pagination, page: pagination.currentPage, totalPages: pagination.totalPages, sort, categData, categoryArray});
        
    } catch (error) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
    }
};


//product page
export const getProductPage  = async(req,res) => {

    const {pId} = req.params;
    const user = req.session.user || null;

    // const [productData, isWishlisted] = await Promise.all([

    //     Product.findById(pId)
    //     .populate('category', 'name')
    //     .populate('subcategory', 'name')
    //     .lean(),

    //     Wishlist.exists({
    //         owner: req.user.session._id,
    //         products: pId
    //     })

    // ])

    
    const productData = await Product.findById(pId).populate("category", "name _id").populate("subcategory", "name").lean();
    
    let isWishlisted = false;

    if (user) {
        isWishlisted = !!(await Wishlist.exists({
            owner: req.session.user._id,
            products: pId
        }))
    }

    console.log({productData, isWishlisted});

    let relatedProducts = await Product.find(

        {
            category: productData.category,
            _id: {$ne: pId},
            isUnListed: false,
            stock: { $gt: 0 }
        }
    
    ).populate("category", "name");
    
    
    
    // ------------- offer fetching and calculations 

    const finalProductData = await findBestPrice(productData);
    console.log({finalProductData: finalProductData[0]});
    // const now = new Date();
    // const offer = await Offer.findOne({
    //     isActive: true,
    //     validFrom: {$lte: now},
    //     expiry: {$gte: now},
    //     "appliesTo.categName" : productData.category.name
    // }).lean();


    // let offerPrice, product;
    // if (offer) {

    //     if(offer.isPercent){
    //         offerPrice = productData.price - (productData.price * offer.offerAmount/100);
    //     }else{
    //         offerPrice = productData.price - offer.offerAmount;
    //     }

    //     product = {
    //         ...productData.toObject(),
    //         offerPrice,
    //         offer: offer.name 
    //     };

    // }else{
        
    //     offerPrice = productData.price;

    //     product = {
    //         ...productData.toObject(),
    //         offerPrice
    //     };
    // }

    // --------- offer fetching and calculations end

    return res.status(STATUS_CODES.SUCCESS).render("user-product-page", {
        finalProductData: finalProductData[0],
        user,
        relatedProducts,
        isWishlisted
    });


};