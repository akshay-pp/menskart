import { Order } from "../models/order.model.js";
import { PAGINATION_CONFIG } from "./constants/config.js";
import { STATUS_CODES } from "./constants/statusCodes.js";

export const generateDashboardData = async function(query) {
    
    try {
        const now = new Date();
        const nowForMonthly = new Date();
        const { start, end } = query;
        const interval = query.interval || "all-time";
        console.log(query);
        let fromDate = new Date("2024-03-25");
        let groupId;
        let labels = [];
        let data = [];
        let indexMap = {};
        switch (interval) {
            
            case 'daily':
                fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                groupId = { $hour: "$createdAt" };

                labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
                data = Array(24).fill(0);
                break;
            
            case 'weekly':
                const day = now.getDay();
                fromDate = new Date(now);
                fromDate.setDate(now.getDate() - day);
                fromDate.setHours(0, 0, 0, 0);

                groupId = { $dayOfWeek: "$createdAt" };
                labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                data = Array(7).fill(0);
                break;
            
            case 'monthly':
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
                groupId = { $dayOfMonth: "$createdAt" };

                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
                data = Array(daysInMonth).fill(0);
                break;
            
            case 'yearly':
                fromDate = new Date(now.getFullYear(), 0, 1);
                groupId = { $month: "$createdAt" };

                labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                data = Array(12).fill(0);
                break;
            
            case 'custom':
                fromDate = new Date(start);
                now.setTime(new Date(end).getTime());
                groupId = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

                // const diffDays = Math.ceil((now - fromDate) / (1000 * 60 * 60 * 24));
                // labels = Array.from({ length: diffDays }, (_, i) => `Day ${i + 1}`);
                for (let d = new Date(fromDate); d <= now; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split("T")[0];
                    labels.push(dateStr);
                    data.push(0);
                };

                labels.forEach((label, i) => {
                    indexMap[label] = i;
                });
                // data = Array(diffDays).fill(0);
                break;
            
            case 'all-time':
                fromDate = new Date("2024-03-25"); 
                groupId = { $month: "$createdAt" };

                labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                data = Array(12).fill(0);
                break;
        }

        console.log(fromDate)
        const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const latestOrders = await Order.find({}).sort({createdAt: -1}).populate('owner', 'fullname').limit(PAGINATION_CONFIG.DEFAULT_LIMIT);
        
        console.log("req.query:", query);
        console.log("Interval:", interval);
        console.log("Start:", start);
        console.log("End:", end);
        console.log("From Date:", fromDate.toISOString());
        console.log("Now:", now.toISOString());
        
        
        
        const thisMonthRevenue = await Order.aggregate([
            { $match: {createdAt: {$gte: firstDayThisMonth, $lte: nowForMonthly}} },
            { $group: {_id: null, thisMonthRevenue: {$sum: "$totalPrice"}} }
        ]);


        const productSales = await Order.aggregate([
            { $match: {createdAt: { $gte: fromDate, $lte: now }} },
            { $unwind: "$orderItems" },
            { $group: {_id: null, productSales: { $sum: "$orderItems.quantity" }} }
        ]);


        const totalRevenue = await Order.aggregate([
            { $match:{createdAt: { $gte: fromDate, $lte: now }}},
            { $group: {_id: null, totalRevenue: { $sum: "$totalPrice" }}}
        ]);


        const totalOrders = await Order.aggregate([
            { $match: {createdAt: { $gte: fromDate, $lte: now }} },
            { $group: {_id: null, totalOrders: { $sum: 1 }} }
        ]);


        const topTenProducts = await Order.aggregate([
            { $match: {createdAt: {$gte: fromDate, $lte: now}} },
            { $unwind: "$orderItems" },
            {$lookup: {
                from: "products",
                let: {productId: '$orderItems.product'},
                pipeline: [
                    {$match: {
                        $expr: {$eq: ['$_id', '$$productId']}
                    }},
                    {$project: {
                        price: 1,
                        productname: 1,
                        stock: 1,
                        thumbnail: {$arrayElemAt: ['$images', 0]}
                    }}
                ],
                as: 'productData'
            }},
            {$unwind: "$productData"},
            { $group: {_id: "$orderItems.product", count: {$sum: 1}, productData: {$first: "$productData"}} },
            {$sort: {count: -1}},
            { $limit: 10 }
        ]);


        const topTenCategories = await Order.aggregate([
            { $match: {createdAt: {$gte: fromDate, $lte: now}} },
            { $unwind: "$orderItems" },
            { $lookup: {
                from: "products",
                let: {productId: "$orderItems.product"} ,
                pipeline: [
                    {$match: 
                        {$expr: 
                            {$eq: ["$_id", "$$productId"]}
                        }
                    },
                    {$project: {category: 1, _id: 0}}
                ],
                as: "productData"
            }},
            { $unwind: "$productData" },
            { $group: {_id: "$productData.category", count: {$sum: 1}} },
            { $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "categoryData"
            }},
            { $unwind: "$categoryData" },
            { $sort: {count: -1} },
            { $limit: 10 }

        ]);


        const topTenCoupons = await Order.aggregate([
            { $match: {createdAt: {$gte: fromDate, $lte: now}, couponInfo: {$exists: true, $ne: null}} },
            { $group: {_id: "$couponInfo.couponId", count: {$sum: 1}, code: {$first: "$couponInfo.couponCode"}} },
            { $sort: {count: -1} },
            { $limit: 10}
        ]);


        const topTenOffers = await Order.aggregate([
            { $match: {createdAt: {$gte: fromDate, $lte: now}} },
            { $unwind: "$orderItems" },
            { $match: {"orderItems.offerInfo": {$exists: true, $ne: null}} },
            { $group: {_id: "$orderItems.offerInfo.offerId", count: {$sum: 1}} },
            { $lookup: {
                from: "offers",
                localField: "_id",
                foreignField: "_id",
                as: "offerData"
            }},
            { $unwind: "$offerData" },
            { $sort: {count: -1} },
            { $limit: 10}
        ]);

        const chartData = await Order.aggregate([
            { $match: {createdAt: {$gte: fromDate, $lte: now}} },
            { $group: {_id: groupId, count: {$sum: 1}} },
            { $sort: {_id: 1} }
        ]);

        console.log({chartData});

        chartData.forEach(o => {

            switch (interval) {

                case 'daily':
                    data[o._id] = o.count;
                    break;

                case 'weekly':
                    data[o._id - 1] = o.count; // MongoDB: 1–7
                    break;

                case 'monthly':
                case 'yearly':
                case 'all-time':
                    data[o._id - 1] = o.count;
                    break;

                case 'custom':

                    const index = indexMap[o._id];
                    if (index !== undefined) {
                        data[index] = o.count;
                    }
                    // const index = Math.floor(
                    //     (new Date(o._id) - fromDate) / (1000 * 60 * 60 * 24)
                    // );

                    // if (index >= 0 && index < data.length) {
                    //     data[index] = o.count;
                    // }
                    break;
            }

        });

        
        const topCustomers = await Order.aggregate([
            { $match: {createdAt: {$gte: fromDate, $lte: now}}},
            { $group: {_id: "$owner", spending: {$sum: "$totalPrice"}}},
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$_id", "$$userId"] }
                            }
                        },
                        {
                            $project: {
                                fullname: 1,
                                email: 1,
                                _id: 0
                            }
                        }
                    ],
                    as: "userData"
                }
            },
            { $unwind: "$userData"},
            { $sort: {spending: -1}},
            { $limit: 10}
        ]);

        // console.log(topCustomers);


        // const topSpendingCustomers = Order.aggregate([
        //     { $match: {createdAt: {$gte: fromDate, $lte: now}}},
        //     { $group: {_id: "$owner", spending: {$sum: totalPrice}}},
        //     { $lookup: {
        //         from: "users",
        //         localField: "_id",
        //         foeignField: "_id",
        //         as: "userData"
        //     }}
        // ]);

        // let topSpendingData = []
        // topSpendingCustomers.forEach(customer => {
        //     let customerName = customer.userData.fullname;
        //     let spending = customer.spending;
        //     topSpendingData.push({customer: spending});
        // });

        // const newSignups = await User.aggregate([
        //     { $match: {createdAt: {$gte: fromDate, $lte: now}}},
        //     { $group: {_id: groupId, count: {$sum: 1}}}
        // ]);

        // console.log(newSignups);
        // return;

        // let newSingupData = [];
        // newSingups.forEach(item => {
            
        // })

        
        const dashboardData = { 

            // thisMonthRevenue,
            // productSales,
            // totalRevenue,
            // totalOrders,
            thisMonthRevenue: thisMonthRevenue[0]?.thisMonthRevenue || 0,
            productSales: productSales[0]?.productSales || 0,
            totalRevenue: totalRevenue[0]?.totalRevenue || 0,
            totalOrders: totalOrders[0]?.totalOrders || 0,
            topTenProducts: topTenProducts || [],
            topTenCategories: topTenCategories || [],
            topTenCoupons : topTenCoupons || [],
            topTenOffers : topTenOffers || [],
            topCustomers : topCustomers || []

        };
        
        return {data: dashboardData, chartData: {labels, data}, latestOrders, interval, start, end};
        // console.log(data);
        // return res.status(STATUS_CODES.SUCCESS).json({user: req.session.user, data, latestOrders, interval, start, end});
    
    } catch (error) {
        console.error("Error fetching total sales and revenue:", error);
        return { totalSales: 0, totalRevenue: 0 };
    }
}