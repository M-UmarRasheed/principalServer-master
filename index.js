const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
require("dotenv").config();
const upload = require("express-fileupload");
const xlsxFile = require("read-excel-file/node");
const app = express();
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectID;
const port = 4000;

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z2baq.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const uri = "mongodb://127.0.0.1:27017"
app.use(bodyParser.json());
app.use(cors());
app.use(upload());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const client = new MongoClient(
  uri,
  { useUnifiedTopology: true },
  { useNewUrlParser: true },
  { connectTimeoutMS: 30000 },
  { keepAlive: 1 }
);
client.connect((err) => {
  console.log("connected");
  const LicenseUserCollection = client
    .db("LicenseSoftware")
    .collection("userLicense");
  const adminCollection = client.db("LicenseSoftware").collection("admin");

  app.post("/LicenseRegistration", (req, res) => {
    const newUser = req.body;
    LicenseUserCollection.insertOne(newUser).then((result) => {
      res.send(result.insertedCount > 0);
    });
  });
  const normalizeHeaders = (data) => {
    return data.map((item) => {
      return {
        _id: item._id ? ObjectId(item._id) : new ObjectId(),
        ACTIVATION_DATE: item['ACTIVATION DATE'] || '',
        NAME: item.NAME || '',
        PHONE_NUMBER: item['PHONE NUMBER'] || '',
        LICENSE: item.LICENSE || '',
        TERMINAL_ALLOWED: item['TERMINAL ALLOWED'] || '',
        SMS_LICENSE: item['SMS LICENSE'] || '',
        SMS_STATUS: item['SMS STATUS'] || '',
        SMS_DEADLINE_DATE: item['SMS DEADLINE DATE'] || '',
        SMS_COST: item['SMS COST'] || '',
        LICENSE_COST: item['LICENSE COST'] || '',
        UID: item.UID || ''
      };
    });
  };
  
  app.post("/LicenseInfoUpload", (req, res) => {
    const file = req.files.file;
    const fileName = file.name;
    let exceltojson;
    if (fileName.split(".")[fileName.split(".").length - 1] === "xlsx") {
      exceltojson = xlsxtojson;
    } else {
      exceltojson = xlstojson;
    }
    file.mv("./fileUpload/" + fileName, (err) => {
      if (err) {
        console.log(err);
      } else {
        try {
          exceltojson(
            {
              input: "./fileUpload/" + fileName,
              output: null,
              lowerCaseHeaders: false,
            },
            function (err, result) {
              if (err) {
                return res.json({ error_code: 1, err_desc: err, data: null });
              }
              
              // Debugging output
              console.log("Converted JSON data:", result);
              
              const normalizedData = normalizeHeaders(result);
              console.log("🚀 ~ file.mv ~ normalizedData:", normalizedData)
  
              LicenseUserCollection.insertMany(normalizedData).then((result) => {
                if (result.insertedCount > 0)
                  res.redirect("http://localhost:3000/users");
              });
            }
          );
        } catch (e) {
          res.alert("file uploaded");
        }
        const deleteFile = "./fileUpload/" + fileName;
        fs.unlink(deleteFile, function (err) {
          if (err) {
            throw err;
          }
        });
      }
    });
  });
  
  // app.post("/LicenseInfoUpload", (req, res) => {
  //   const file = req.files.file;
  //   const fileName = file.name;
  //   let exceltojson;
  //   if (fileName.split(".")[fileName.split(".").length - 1] === "xlsx") {
  //     exceltojson = xlsxtojson;
  //   } else {
  //     exceltojson = xlstojson;
  //   }
  //   file.mv("./fileUpload/" + fileName, (err) => {
  //     if (err) {
  //       console.log(err);
  //     } else {
  //       try {
  //         exceltojson(
  //           {
  //             input: "./fileUpload/" + fileName,
  //             output: null,
  //             lowerCaseHeaders: false,
  //           },
  //           function (err, result) {
  //             if (err) {
  //               return res.json({ error_code: 1, err_desc: err, data: null });
  //             }
  //             LicenseUserCollection.insertMany(result).then((result) => {
  //               if (result.insertedCount > 0)
  //                 res.redirect("http://localhost:3000/users");
  //             });
  //           }
  //         );
  //       } catch (e) {
  //         res.alert("file uploaded");
  //       }
  //       const deleteFile = "./fileUpload/" + fileName;
  //       fs.unlink(deleteFile, function (err) {
  //         if (err) {
  //           throw err;
  //         }
  //       });
  //     }
  //   });
  // });
  app.get("/isAdmin/:data", (req, res) => {
    console.log("🚀 ~ app.get ~ req:", req.params)
    
    const array = req.params.data.split("-");
    console.log("🚀 ~ app.get ~ array:", array)
    const userName = array[0];
    console.log("🚀 ~ app.get ~ userName:", userName)
    const password = array[1];
    console.log("🚀 ~ app.get ~ password:", password)
    adminCollection
      .find({
        userName: userName,
        password: password,
      })
      .toArray((err, docs) => {
        console.log("🚀 ~ .toArray ~ docs:", docs)
        res.send(docs[0]);
      });
  });
  app.patch("/activateLicense", (req, res) => {
    LicenseUserCollection.find({
      LICENSE: req.body.License,
      UID: req.body.UID,
      PHONE_NUMBER: req.body.phoneNumber,
    }).toArray((err, docs) => {
      if (docs.length === 1) {
        res.send(docs[0]);
      } else {
        LicenseUserCollection.find({
          LICENSE: req.body.License,
          UID: "",
          PHONE_NUMBER: "",
        }).toArray((err, docs) => {
          if (docs.length === 0) {
            res.send(false);
          }
          if (docs.length !== 0) {
            LicenseUserCollection.updateOne(
              { LICENSE: req.body.License },
              {
                $set: {
                  ACTIVATION_DATE: new Date(),
                  UID: req.body.UID,
                  PHONE_NUMBER: req.body.phoneNumber,
                },
              }
            ).then((result) => {
              if (result.modifiedCount > 0) {
                LicenseUserCollection.find({
                  LICENSE: req.body.License,
                }).toArray((err, docs) => {
                  res.send(docs[0]);
                });
              }
              if (result.modifiedCount === 0) {
                res.send(false);
              }
            });
          }
        });
      }
    });
  });
  app.post("/activateSmsLicense", (req, res) => {
    (license = req.body.License), (key = req.body.smsKey), (uid = req.body.UID);

    LicenseUserCollection.find({
      LICENSE: license,
      SMS_LICENSE: key,
      UID: uid,
    }).toArray((err, docs) => {
      if (docs.length !== 0) {
        res.send(docs[0]);
      }
      if (docs.length === 0) {
        res.send(false);
      }
    });
  });

  app.get("/allUsers", (req, res) => {
    console.log("in heree");
    LicenseUserCollection.find({}).toArray((err, documents) => {
      console.log("🚀 ~ LicenseUserCollection.find ~ documents:", documents)
      res.send(documents);
    });
  });

  app.patch("/updateSmsDate", (req, res) => {
    const id = req.body.id;
    const date = req.body.date;
    LicenseUserCollection.updateOne(
      { _id: ObjectId(id) },
      { $set: { SMS_DEADLINE_DATE: date } }
    ).then((result) => {
      res.send(result.modifiedCount > 0);
    });
  });
  app.patch("/updateStatus", (req, res) => {
    const id = req.body.id;
    const status = req.body.status;
    LicenseUserCollection.updateOne(
      { _id: ObjectId(id) },
      { $set: { SMS_STATUS: status } }
    ).then((result) => {
      res.send(result.modifiedCount > 0);
    });
  });

  app.patch("/updateUserData", (req, res) => {
    const id = req.body.id;
    const status = req.body.status;
    const name = req.body.name;
    if (name === "TERMINAL_ALLOWED") {
      LicenseUserCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: { TERMINAL_ALLOWED: status } }
      ).then((result) => {
        res.send(result.modifiedCount > 0);
      });
    }
    if (name === "NAME") {
      LicenseUserCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: { NAME: status } }
      ).then((result) => {
        res.send(result.modifiedCount > 0);
      });
    }
  });
  app.delete("/deleteUser/:id", (req, res) => {
    const UserID = req.params.id;

    LicenseUserCollection.deleteOne({ _id: ObjectId(UserID) }).then(
      (result) => {
        res.send(result.deletedCount > 0);
      }
    );
  });
});

app.listen(process.env.PORT || port);
