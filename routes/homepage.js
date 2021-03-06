require('dotenv').config();

const http = require("http");
const express = require('express');
const router  = express.Router();
const bcrypt  = require("bcrypt");
const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.ACCOUNT_TOKEN;
const client = require('twilio')(accountSid, authToken);

module.exports = (db) => {
  router.get("/", (req, res) => {
    const id = req.session.userId;
    let queryString;
    let queryParams;

    if (id) {
      queryString = `
        SELECT users.*, food_items.cost, food_items.item_description, food_items.item_name, food_items.category
        FROM users
        JOIN stores ON stores.id = users.store_id
        JOIN food_items ON stores.id = food_items.store_id
        WHERE users.id = $1
      `;

      queryParams = [id];
      db.query(queryString, queryParams)
      .then(res => {
        if(res.rows.length > 0){
          return res.rows;
        }
        return null;
      })
      .then(data => {
        const templateVars = {
          data:data,
          error: null
        }
        res.render('homepage', templateVars);
      });
    } else {
      queryString = `
        SELECT food_items.category, food_items.cost, food_items.item_description, food_items.item_name
        FROM food_items
      `;

      queryParams = [];
      db.query(queryString, queryParams)
      .then(res => {
        if(res.rows.length > 0){
          return res.rows;
        }
        return null;
      })
      .then(data => {
        const templateVars = {
          data:data,
          error: null
        }
        res.render('homepage', templateVars);
      });
    }

    router.post("/pay", (req, res) => {

      const id = req.session.userId;
      let foodItems = req.body.foodItems;
      let foodItemQuantity = req.body.foodItemQuantity;
      let totalCost = req.body.totalCost;
      let foodItemQuantityArray = foodItemQuantity.split(" ");

      //Taken from stackOverflow
      //stackOverflow url: https://stackoverflow.com/questions/2817646/javascript-split-string-on-space-or-on-quotes-to-array?lq=1
      //The parenthesis in the regex creates a captured group within the quotes
      let myRegexp = /[^\s"]+|"([^"]*)"/gi;
      let foodItemArray = [];

      do {
          //Each call to exec returns the next regex match as an array
          var match = myRegexp.exec(foodItems);
          if (match != null)
          {
              //Index 1 in the array is the captured group if it exists
              //Index 0 is the matched text, which we use if no captured group exists
              foodItemArray.push(match[1] ? match[1] : match[0]);
          }
      } while (match != null);
      // End of script taken from stackOverflow

      if(id) {
        let checkoutsQueryString = `
          INSERT INTO checkouts(user_id, total_cost, store_id)
          VALUES ($1, $2, 1)
          RETURNING id;
        `
        let checkoutsQueryParams = [id, totalCost];

        db.query(checkoutsQueryString, checkoutsQueryParams)
        .then(res=>res.rows[0])
        .then(id => {
          let checkoutId = id["id"];
          for (let i=0; i< foodItemArray.length; i++) {
            let foodItemQueryString = `
              SELECT id
              FROM food_items
              WHERE item_name = $1
            `
            let foodItemQueryParams = [foodItemArray[i]];

            db.query(foodItemQueryString, foodItemQueryParams)
            .then(res => res.rows[0])
            .then(id => {
              let foodItemId = id["id"];

              let checkoutItemsQueryString = `
                INSERT INTO checkout_items(food_item_id, checkout_id, quantity)
                VALUES ($1, $2, $3);
              `
              let checkoutItemsQueryParam = [foodItemId, checkoutId, foodItemQuantityArray[i]];

              db.query(checkoutItemsQueryString, checkoutItemsQueryParam);
            })
          }
        })
      }

    });

    router.post("/sms", (req,res) => {
      let clientName = req.body.name;
      let clientNumber = req.body.phoneNumber;

      client.messages
      .create({
        from: '+12267991117',
        body: `Hey ${clientName}, come pick up your order in 30 minutes!`,
        to: process.env.CLIENT
      })
      .then(message => {
        res.send();
      });

      client.messages
      .create({
        from: '+12267991117',
        body: `${clientName} has placed an order. Get to work! Client phone number is: ${clientNumber}`,
        to: process.env.RESTAURANT
      })
      .then(message => {
        res.send();
      });

    });

    router.post("/search", (req,res) => {
      const itemName = req.body.name;
      
      const searchQueryString = `
        SELECT category
        FROM food_items
        WHERE item_name = $1;
      `;

      const searchQueryParams = [itemName];

      db.query(searchQueryString, searchQueryParams)
      .then(data => {
        res.send(data.rows);
      });
      
    });

    router.get("/items", (req,res) => {
      const itemNameQueryString = `
        SELECT item_name
        FROM food_items
      `

      db.query(itemNameQueryString)
      .then(data => {
        res.send(data.rows);
      })
    })

  });
  return router;
}
