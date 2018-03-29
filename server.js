const express = require("express"),
    bodyParser = require("body-parser"),
    bcrypt = require("bcrypt"),
    session = require('client-sessions'),
    ejs = require("ejs"),
    shortId = require("shortid"),
    multer = require("multer"),
    fs = require("fs"),
    db = require("diskdb");

//connect to db
db.connect("data", ["users", "images"]);



//express values
const app = express();
const port = 8080;

const upload = multer({dest: 'uploads'});

//bodyparser settings
app.use(bodyParser.urlencoded({
    extended: true
}));

//session settings
app.use(session({
  cookieName: 'session',
  secret: 'cookiecat', // <-- do not actually use use this password
  duration: 24 * 60 * 60 * 1000,
  activeDuration: 60 * 60 * 1000,
}));

//static server
app.use(express.static("views"));

app.set("view engine", "ejs");

//main route
app.get("/", function(req, res){

    //check if user is logged in
    if(req.session.user){

        //if they are logged in send too dash
        res.redirect("/dash");
    } else {

        //otherwise send too index
        res.render("index");
    }
});


//sign up route
app.post("/signUp", function(req, res){
    bcrypt.hash(req.body.password, 12, function(err, hash){

        //if a hash error occurs
        if(err){
            res.render("errorPage", {error: "hash error occured, please try again"});
        } else {
        //if no error occurs
            //if password matches confirm
            if(req.body.password === req.body.passwordConfirm){

                //checking db for other users with same username or email
                let checkUsername = db.users.find({
                    username: req.body.username
                });

                let checkEmail = db.users.find({
                    email: req.body.email
                });

                if(checkUsername.length > 0 || checkEmail.length > 0){
                    //check if account info is already being used
                    res.render("errorPage", {error: "that email or username is already being used :("});
                } else {

                    //save user in db
                    db.users.save({
                        username: req.body.username,
                        password: hash,
                        email: req.body.email
                    });

                    //get user data
                    let user = db.users.find({
                        username: req.body.username
                    });

                    //put in session key and redirect
                    req.session.user = user[0];
                    res.redirect("/dash");
                }

            } else {

                //if password confirm doesnt match actual pasword
                res.render("errorPage", {error: "your passwords didnt match :("});
            }
        }
    });
});

app.post("/login", function(req, res){

    //get user
    let user = db.users.find({
        username: req.body.username
    });
    
    if(user[0]){
        //check if users password is correct
        bcrypt.compare(req.body.password, user[0].password, function(err, result){

            //handle comparison errors
            if(err){

                res.render("errorPage", {error: "An error occured while validating your info"});
            } else {
                //if no error and password is correct

                if(result){

                    //if creds are valid an no error set session
                    req.session.user = user[0];

                    //and redirect too dashboard page
                    res.redirect("/dash");

                } else {
                    res.render("errorPage", {error: "your username or password wa incorrect :("});
                }
            }
        });
    } else {
        res.render("errorPage", {error: "we couldn't find any users by that name :("});
    }
});

//logout route
app.get("/logout", function(req, res){

    //reset session key
    req.session.reset();

    //redirect too home
    res.redirect("/");
});

app.get("/dash", function(req, res){
    if(req.session.user){
        /*
        ADD IMAGE SHARING BITS HERE <-- innaccurate now
        */
        let images = db.images.find({
            user: req.session.user.username
        });
        //render dashboard
        res.render("dash", {username: req.session.user.username, images: images});

    } else {
        //if user has no session, redirect back too login page
        res.render("errorPage", {error: "we couldn't find any session data :("});
    }
});

//get upload page
app.get("/upload", function(req, res){

    //only allow uploads if logged in
    if(req.session.user){

        //if logged in render upload page
        res.render("upload");
    } else {
        //otherwise send login error
        res.render("errorPage", {error: "you're not logged in"});
    }
});

app.post("/upload", upload.single("photo"), function(req, res){

    //check if logged in
    if(req.session.user){

        if(req.file){
            //generate id for image
            let id = shortId.generate();

            //save image
            db.images.save({
                id: id,
                path: req.file.filename,
                user: req.session.user.username,
                time: Date.now()
            });

            //redirect back too dashboard
            res.redirect("/dash");
        } else {
            res.render("errorPage", {error: "no file selected"});
        }
    } else {
    //if not logged in
        res.render("errorPage", {error: "you're not logged in"});
    }
});

app.get("/image/:id", function(req, res){

    //lookup image in database
    let image = db.images.find({
        id: req.params.id
    });

    //if image doesnt exist
    if(image.length < 0){

        //send error page
        res.render("errorPage", {error: "we couldn't find that image :("});
    } else {

        //if it does exist send too client
        fs.readFile("uploads/" + image[0].path, function(err, data){

            if(err){
                //render error page
                res.render("errorPage", {error: "an error occured :("});
            } else {

                //sending too client as b64
                res.send("<img alt='Embedded Image' src='data:image/png;base64," + data.toString("base64") + "'>");
            }
        });
    }
});

app.listen(port, function(){
    console.log("server listening on " + port);
});
