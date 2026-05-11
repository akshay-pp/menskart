import {Router} from 'express';
const router = Router();
import {getOrderDetails} from '../controllers/api.controllers.js';


router.get('/order/:orderId/item/:itemId', getOrderDetails)




export default router
