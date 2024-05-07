const express = require("express");
const dotenv = require("dotenv").config();
const cors = require("cors");
const colors = require("colors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

// init express
const app = express();

// environment variable
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// VerifyTokenMiddleware
const verifyTokenMiddleware = async (req, res, next) => {
  // Get tokent from cookies
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  // Now verify token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.status(401).send({ message: "Unauthorized" });
    } else {
      req.user = decoded;
      next();
    }
  });
};

// Mongodb connection.
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log(`MongoDb connection is successfull`.bgGreen.black);

    // Get services collections.
    const servicesCollection = client
      .db("carDoctorDb")
      .collection("servicesCollection");

    // Get Order collections.
    const orderCollection = client
      .db("carDoctorDb")
      .collection("orderCollection");

    /**
     *  Auth API
     * =========
     */

    // Create access token api for login user
    app.post("/jwt", async (req, res) => {
      const loggedInUser = req.body;
      const email = loggedInUser.email;
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
      });

      res.send({ success: true });
    });

    // Logout user api
    app.get("/logout", async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ logout: true });
    });

    // Routes
    app.get("/", (req, res) => {
      res.send(`Car doctor server is running on port: ${port}`);
    });

    // Get all Services Data.
    app.get("/services", async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result);
    });
    // Get single services data.
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.send(result);
    });

    // OrderApi area.
    // Get my orderList api
    app.get("/orderlist", verifyTokenMiddleware, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query?.email };
      }

      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // Order confirm api
    app.post("/order", async (req, res) => {
      const newOrder = req.body;
      const result = await orderCollection.insertOne(newOrder);
      res.send(result);
    });

    // Status update api
    app.put("/order/status/update", async (req, res) => {
      const { id } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: true,
        },
      };
      const result = await orderCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Delete Order
    app.delete("/order/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// listen server.
app.listen(port, () => {
  console.log(`Server is running on port : ${port}`.bgMagenta.black);
});
