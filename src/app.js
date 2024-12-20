import express from "express";
import session from "express-session";

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set('views', 'E:/Web Dev Stuffs/Brototype/menskart/src/views');
app.set('view engine', 'ejs');
app.use(express.static("./src/views"));
app.use(express.static("./"));

app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: { maxAge: 1000*60*30 }, // 30 minutes
    })
);

import {getHome, errorPage, signInGoogle, signUpGoogle} from "./controllers/user.controllers.js";


// import routes
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
// import productRoutes from "./routes/products.routes.js"



// routes declaration
app.get("/", getHome)
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/api/p", productRoutes);

app.post('/auth/google/login', signInGoogle);
app.post('/auth/google/register', signUpGoogle);
app.use(errorPage);



export {app};