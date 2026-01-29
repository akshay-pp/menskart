import {Offer} from "../models/offer.model.js"

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