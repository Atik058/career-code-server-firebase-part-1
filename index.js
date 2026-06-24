const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// =======================
// Middleware
// =======================

// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "https://your-frontend-vercel-domain.vercel.app"
//     ],
//     credentials: true,
//   })
// );
app.use(cors());

app.use(express.json());


// =======================
// Firebase Admin Setup
// =======================

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const serviceAccount = require("./firebase-admin-service.json");

initializeApp({
  credential: cert(serviceAccount),
});


// =======================
// Firebase Token Middleware
// =======================

const verifyFirebaseToken = async (req, res, next) => {

  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      message: "unauthorized access"
    });
  }


  const token = authHeader.split(" ")[1];

  try {

    const decoded = await getAuth().verifyIdToken(token);

    req.decoded = decoded;

    next();

  } catch (error) {

    console.log("Firebase token error:", error);

    return res.status(401).send({
      message: "unauthorized access"
    });

  }

};


const verifyTokenEmail = (req, res, next) => {

  if (req.query.email !== req.decoded.email) {

    return res.status(403).send({
      message: "forbidden access"
    });

  }

  next();

};


// =======================
// MongoDB Setup
// =======================

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vfvznss.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


let jobsCollection;
let applicationsCollection;


async function connectDB() {

  if (jobsCollection && applicationsCollection) {
    return;
  }


  await client.connect();


  const db = client.db("careerCode");


  jobsCollection = db.collection("jobs");

  applicationsCollection = db.collection("applications");


  console.log("MongoDB Connected");

}


// Database middleware

app.use(async (req, res, next) => {

  try {

    await connectDB();

    next();

  } catch (error) {

    console.log("Database connection error:", error);


    res.status(500).send({
      message: "Database connection failed"
    });

  }

});



// =======================
// Routes
// =======================


app.get("/", (req, res) => {

  res.send("Career Code is Cooking");

});



app.get("/jobs", async (req, res) => {

  const email = req.query.email;

  const query = {};


  if (email) {
    query.hr_email = email;
  }


  const result = await jobsCollection
    .find(query)
    .toArray();


  res.send(result);

});

//  debug api for mypostedjobs
app.get("/jobs/applications",
  verifyFirebaseToken,
  verifyTokenEmail,
  async (req, res) => {
  try {
    const email = req.query.email;

    console.log("Email:", email);

    const jobs = await jobsCollection
      .find({
        hr_email: email,
      })
      .toArray();

    console.log("Jobs found:", jobs.length);

    for (const job of jobs) {
      const count = await applicationsCollection.countDocuments({
        jobId: job._id.toString(),
      });

      job.application_count = count;
    }

    res.send(jobs);
  } catch (error) {
    console.error("ERROR IN /jobs/applications:", error);
    res.status(500).send(error.message);
  }
});



app.get("/jobs/:id", async (req, res) => {

  const id = req.params.id;


  const result = await jobsCollection.findOne({
    _id: new ObjectId(id)
  });


  res.send(result);

});



app.post("/jobs", async (req, res) => {

  const newJob = req.body;


  const result = await jobsCollection.insertOne(newJob);


  res.send(result);

});




// =======================
// Applications API
// =======================


app.get(
  "/applications",
  verifyFirebaseToken,
  verifyTokenEmail,
  async (req, res) => {


    const email = req.query.email;


    const query = {
      applicant: email
    };


    const result = await applicationsCollection
      .find(query)
      .toArray();



    for (const application of result) {

      const job = await jobsCollection.findOne({
        _id: new ObjectId(application.jobId)
      });


      application.company = job.company;
      application.title = job.title;
      application.company_logo = job.company_logo;

    }

    res.send(result);
  });




// app.get(
//   "/jobs/applications",

//   async (req, res) => {


//     const email = req.query.email;

//     // verifyFirebaseToken,
//     // if(email !== req.decoded.email){

//     //   return res.status(403).send({
//     //     message:"forbidden access"
//     //   });

//     // }



//     const jobs = await jobsCollection
//       .find({
//         hr_email: email
//       })
//       .toArray();



//     for (const job of jobs) {

//       const count = await applicationsCollection
//         .countDocuments({
//           jobId: job._id.toString()
//         });


//       job.application_count = count;

//     }


//     res.send(jobs);

//   });



app.get(
  "/applications/job/:job_id",
  async (req, res) => {


    const job_id = req.params.job_id;


    const result = await applicationsCollection
      .find({
        jobId: job_id
      })
      .toArray();



    res.send(result);

  });




app.post(
  "/applications",
  async (req, res) => {


    const application = req.body;


    const result = await applicationsCollection
      .insertOne(application);



    res.send(result);

  });




app.patch(
  "/applications/:id",
  async (req, res) => {


    const id = req.params.id;


    const result = await applicationsCollection.updateOne(
      {
        _id: new ObjectId(id)
      },
      {
        $set: {
          status: req.body.status
        }
      }
    );


    res.send(result);

  });



app.get("/test-deploy", (req, res) => {

  res.send("NEW DEPLOY WORKING");

});



// =======================
// Error Handler
// =======================

app.use((err, req, res, next) => {

  console.error(err);


  res.header(
    "Access-Control-Allow-Origin",
    "*"
  );


  res.status(500).send({
    message: "Internal Server Error"
  });

});



// app.listen(port, () => {

//   console.log(`Server running on port ${port}`);

// });


// Vercel export
module.exports = app;