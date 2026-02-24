import {Offer} from "../models/offer.model.js"

export const findBestPrice = async (products) => {
    const productIds = products.map(p => p._id);
    const categoryIds = [...new Set(products.map(p => p.category))];
    const now = new Date();

    const offers = await Offer.find({
        isActive: true,
        validFrom: {$lte: now},
        expiry: {$gte: now},
        $or: [
            {productIds: {$in: productIds}},
            {'appliesTo.categId': {$in: categoryIds}}
        ]
    });

    const offerMap = new Map();

    for (const offer of offers) {

    }
    
}