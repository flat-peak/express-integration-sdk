import { Validator } from "jsonschema";
import schema from "../schemes/state-schema.json";
import { SharedStateData } from "../types";

const validator = new Validator();

export const decodeState = (data: string): SharedStateData => {
  const state = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  const res = validator.validate(state, schema);

  if (!res.valid) {
    throw new Error(`Invalid state: ${res.errors[0].stack}`);
  }

  return state;
};

export const encodeState = (state: SharedStateData) => {
  return Buffer.from(JSON.stringify(state)).toString("base64");
};
