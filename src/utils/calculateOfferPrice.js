import {Offer} from "../models/offer.model.js"

export const findBestPrice = async (...products) => {

    // if product has no offer, return as it is.
    // else, attach a coupon object to the product doc.

    const productIds = products.map(p => p._id);
    const categoryIds = [...new Set(products.map(p => p.category))];
    console.log({pNos: productIds.length, cNos: categoryIds.length}, '✅');
    const now = new Date();

    const offers = await Offer.find({
        // isActive: true,
        // validFrom: {$lte: now},
        // expiry: {$gte: now},
        $or: [
            {productIds: {$in: productIds}},
            {'appliesTo.categId': {$in: categoryIds}}
        ]
    })

    console.log(`no. of offers: ${offers.length}`);

    if (!offers.length) {
        return products;
    };

    // console.log('========== offers =============');
    // console.log({offers}, '✅');
    // console.log('========== offers =============');

    const categoryOfferMap = new Map();
    const productCategoryOfferMap = new Map();
    const productOfferMap = new Map();
    
    for (const offer of offers) {
        if (offer.type == "category" && offer.appliesTo?.length){
            for (const category of offer.appliesTo) {
                const key = category.categId.toString();
                if (!categoryOfferMap.has(key)){
                    categoryOfferMap.set(key, []);
                }
                categoryOfferMap.get(key).push(offer);
            }
        } else if (offer.productIds) {
            console.log(`product offer: ${offer.productIds}`);
            productOfferMap.set(offer.productIds, offer);
        } else {
            continue;
        }
    };

    for (const product of products) {
        const productId = product._id.toString();
        const categoryId = product.category._id.toString();
        const offersForProductCategory = categoryOfferMap.get(categoryId) || [];
        // console.log({productId, categoryId, offersForProductCategory});
        productCategoryOfferMap.set(productId, offersForProductCategory);
    };

    // console.log('========== lookup maps =============');
    // console.log({categoryOfferMap,  productCategoryOfferMap, productOfferMap}, '✅')
    // console.log('========== lookup maps =============');
    
    const pIdToOfferPrices = new Map();
    const bestPriceAndOffer = new Map();

    //debugging purpose
    for (const product of products) {
        console.log({name: product.productname, listingPrice: product.price});
    }


    for (const product of products){
        
        let bestOffer = null, bestPrice = product.price, discount = 0;
        let productOfferPrice;
        
        const productOffer = productOfferMap.get(product._id.toString());
        
        if (productOffer) {
            productOfferPrice = calculateFinalPrice(productOffer, product.price);
            if (productOfferPrice < bestPrice){
                bestPrice = productOfferPrice;
                bestOffer = productOffer;
            }
        }
    
        //get category offers
        let categoryOffers = productCategoryOfferMap.get(product._id.toString());
        // console.log({product: product._id, offer: categoryOffers});
        if (!categoryOffers?.length){
            continue;
        };

        //loop through each offer
        for (const offer of categoryOffers) {

            if (product.price < offer.minimumValue) {
                continue;
            };
            //calculate final price after applying offer
            let offerAppliedData = calculateFinalPrice(offer, product.price);

            //check if currentPrice < bestPrice
            if(offerAppliedData.offerPrice < bestPrice) {
                // if yes, reassign bestPrice and bestOffer
                bestPrice = offerAppliedData.offerPrice;
                bestOffer = offer;
                discount = offerAppliedData.discount;
            }

            //debugging purpose
            if (!pIdToOfferPrices.has(product.productname)){
                pIdToOfferPrices.set(product.productname, []);
            }
            pIdToOfferPrices.get(product.productname).push({listPrice: product.price, offer: offer.offerAmount, priceAfterOffer: offerAppliedData.offerPrice, discount:offerAppliedData.discount, bestPrice});
        
        }

        product.offerPrice = Math.round(bestPrice);
        product.appliedDiscount = discount;
        product.offer = bestOffer;

        // console.log({product: product.productname, bestPrice, discount, bestOffer});

        //debugging purpose
        bestPriceAndOffer.set(product._id, {name: product.productname, bestPrice: Math.round(bestPrice), bestOffer});

        
    }
    
    // console.log({productsWithOfferPrices: products});
    // console.log('========= pId to offer prices =========');
    // console.log(pIdToOfferPrices);
    
    // console.log('========= best Price And Offer =========');
    // console.log(bestPriceAndOffer);
    return products;
    
}


const calculateFinalPrice = function (offer, price) {
    if(!offer) return price;

    if (offer.isPercent) {
        let discount = Math.min(offer.maxDiscount ?? Infinity, (price * offer.offerAmount) / 100);
        return {offerPrice: Math.max(1, price - discount), discount};
    } else {
        return {offerPrice: Math.max(1, price - offer.offerAmount), discount: offer.offerAmount};
    }
}






const calculateOfferPrice = async function (products) {

    const now = new Date();

    // fetch all the offers
    const categoryOffers = await Offer.find ({

        isActive: true,
        validFrom: {$lte: now},
        expiry: {$gte: now}

    }).lean()


    // 
    const finalProductData = products.map (product => {
        
        let finalOfferPrice = product.price;
        let appliedOffer = {}

        categoryOffers.forEach (offer => {

            if (product.category.name.toLowerCase() == offer.category.toLowerCase() && product.price >= offer.minimumValue) {
                
                if (offer.isPercent) {

                    let calculatedOfferPrice = product.price - (product.price * offer.offerAmount/100)
                    let offerPrice = Math.min(calculatedOfferPrice, offer.maxDiscount);
                    
                    if (offerPrice <= finalOfferPrice) {
                        finalOfferPrice = offerPrice;
                        appliedOffer = offer;
                    }
                    

                } else {

                    let calculatedOfferPrice = product.price - offer.offerAmount;
                    let offerPrice = Math.min(calculatedOfferPrice, offer.maxDiscount);

                    if (offerPrice <= finalOfferPrice) {
                        finalOfferPrice = offerPrice;
                        appliedOffer = offer;
                    }

                }
            }

        })

    })

}



async function getOffers (products) {

    const now = new Date();

    // fetch all the offers
    const offers = await Offer.find ({

        isActive: true,
        validFrom: {$lte: now},
        expirty: {$gte: now}

    }).lean()


    // 

}