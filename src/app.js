import express from "express";
import session from "express-session";
import morgan from "morgan";


const app = express();

//app config
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set('views', './src/views');
app.set('view engine', 'ejs');
app.use(express.static("./src/views"));
app.use(express.static("./"));
app.use(morgan('dev'));


//express-session
app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: { maxAge: 1000*60*30 }, // 30 minutes
    })
);


import {getHome, errorPage, signUpGoogle, countCart, countWishlist} from "./controllers/user.controllers.js";



// import routes
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";


// import productRoutes from "./routes/products.routes.js"



//set user globally
app.use((req,res,next) => {
  res.locals.user = req.session?.user || null;
  next()
})



//current path
app.use((req,res,next) => {
  res.locals.currentPath = req.path;
  next();
})




//set cart count and wishlist count
app.use(countCart);
app.use(countWishlist);



// routes declaration
app.get("/", getHome)
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/api/p", productRoutes);


app.post('/auth/google/register', signUpGoogle);
app.use(errorPage);



export {app};