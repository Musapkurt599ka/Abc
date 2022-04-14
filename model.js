const { Schema, model } = require("mongoose");

const RamazanGuild = model(
  "RamazanGuild",
  new Schema({
    _id: String,
    cityName: String,
    iftarTime: String,
    sahurTime: String,
    dates: Number,
  })
);

module.exports = {
  RamazanGuild,
};
