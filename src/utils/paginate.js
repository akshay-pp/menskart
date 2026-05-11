export const paginate = async (Model, options = {}) => {
    let {
        page = 1,
        limit = 5,
        sort = "default",
        search = "",
        filters = {},
        populate = [],
        collation = {locale:'en', strength: 2},
        lean = true
    } = options;
    
    page = Math.max(1, Number(page) || 1); 
    limit = Math.max(1, Number(limit) || 5);
    const skip = (page - 1) * limit;
    const sortOption = findSortOption(sort);
    let sortBy = {};

    if (search && search.trim() !== ""){
        filters.$text = {$search: search};
        sortBy = {score: {$meta: "textScore"}, ...sortOption};
    } else {
        sortBy = {...sortOption};
    }
    
    let query = Model.find(filters).collation(collation).sort(sortBy).skip(skip).limit(limit).lean();
    
    if (populate.length) {
        query = query.populate(populate);
    }

    
    console.log(Model, {page, limit, skip, sortBy, search, filters, populate, collation, lean});

    const [data, totalDocs] = await Promise.all([query, Model.countDocuments(filters)]);
    // console.log({data, totalDocs});
    
    return {
        data,
        pagination: {
            totalDocs,
            currentPage: page,
            totalPages: Math.ceil(totalDocs/limit)
        },
        sort
    };
    
}





function findSortOption(sort) {
    const sortOptions = {
            popularity : {sales: -1},
            newestFirst : {createdAt: -1},
            priceAsc : {price: 1},
            priceDesc : {price: -1},
            default : {createdAt : 1},
            alphaAsc : {productname: 1},
            alphaDesc : {productname: -1}
    };

    return sortOptions[sort] || sortOptions.default;
}