const express = require('express')
const cors = require('cors')
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

// middleware
app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");

const serviceAccount = require("./firebase-admin-service.json");

admin.initializeApp({
  credential: admin.cert(serviceAccount)
});


const varifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: "unauthorized access" })
  }
  const token = authHeader.split(' ')[1];

  try {
    const decoded = await getAuth().verifyIdToken(token)
    console.log("decoded token in mw:", decoded);
    req.decoded = decoded;
    next()
  }
  catch (error) {
    console.log("error in mw:", error);
    return res.status(401).send({ message: 'unauthorized access' })
  }

}

const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: 'forbidden access' })
  }
  next()
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vfvznss.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobsCollection = client.db('careerCode').collection('jobs');
    const applicationsCollection = client.db('careerCode').collection('applications')

    // jobs api
    app.get('/jobs', async (req, res) => {

      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }

      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // could be done but should not be done.
    // app.get('/jobsByEmailAddress', async (req, res) => {
    //   const email = req.query.email;
    //   const query = { hr_email: email }
    //   const result = await jobsCollection.find(query).toArray();
    //   res.send(result);
    // })

    app.get('/jobs/applications', varifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access, not you job' })
      }

      const query = { hr_email: email };
      const jobs = await jobsCollection.find(query).toArray();

      // should use aggregate to have optimum data fetching
      for (const job of jobs) {
        const applicationQuery = { jobId: job._id.toString() }
        const application_count = await applicationsCollection.countDocuments(applicationQuery)
        job.application_count = application_count;
      }
      res.send(jobs);

    })


    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.findOne(query);
      res.send(result)
    });

    app.post('/jobs', async (req, res) => {
      const newJob = req.body;
      console.log(newJob);
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    })


    // job applications related apis
    app.get('/applications',varifyFirebaseToken, verifyTokenEmail, async (req, res) => {
      const email = req.query.email;

      // console.log("header from server api:", req.headers)
      const query = {
        applicant: email
      }
      const result = await applicationsCollection.find(query).toArray();

      // bad way to aggregate data
      for (const application of result) {
        const jobId = application.jobId;
        const jobQuery = { _id: new ObjectId(jobId) }
        const job = await jobsCollection.findOne(jobQuery);
        application.company = job.company
        application.title = job.title
        application.company_logo = job.company_logo
      }

      res.send(result);
    });

    // app.get('/applications/:id', () =>{})
    app.get('/applications/job/:job_id', async (req, res) => {
      const job_id = req.params.job_id;
      // console.log(job_id);
      const query = { jobId: job_id }
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/applications', async (req, res) => {
      const application = req.body;
      console.log(application);
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    app.patch('/applications/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: req.body.status
        }
      }

      const result = await applicationsCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Career Code is Cooking')
})

app.listen(port, () => {
  console.log(`Career Code server is running on port ${port}`)
})