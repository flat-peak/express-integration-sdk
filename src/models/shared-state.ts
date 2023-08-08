import { extractKeyFromHeaders } from "../helpers/util";
import { SharedStateData } from "../types";

const InputSharedStateKeys = [
  "provider_id",
  "product_id",
  "customer_id",
  "callback_url",
  "postal_address",
  "geo_location",
];

const GeneratedSharedStateKeys = ["request_id", "tariff_id"];

const PrivateSharedStateKeys = ["auth_metadata"];

const SharedStateKeys = [
  ...InputSharedStateKeys,
  ...GeneratedSharedStateKeys,
  ...PrivateSharedStateKeys,
];

export class SharedState {
  authorisation: string;

  public_key: string;

  data: SharedStateData;

  constructor(
    input: SharedStateData,
    authorisation: string,
    requestId: string,
  ) {
    this.authorisation = authorisation;
    this.public_key = extractKeyFromHeaders(authorisation);
    this.data = {
      provider_id: "",
    };
    this.extend(input);
    if (!this.data.request_id) {
      this.data.request_id = requestId;
    }
  }

  /**
   * @return {SharedStateData}
   */
  getData() {
    return this.data;
  }

  /**
   * @return {string}
   */
  getAuthorisation() {
    return this.authorisation;
  }

  /**
   * @return {string}
   */
  getPublicKey() {
    return this.public_key;
  }

  extend(input: Partial<SharedStateData>) {
    Object.keys(input)
      .filter((k) => SharedStateKeys.includes(k))
      .forEach((k) => {
        this.data[k] = input[k];
      });
    return this;
  }

  toString() {
    return Buffer.from(JSON.stringify(this.data)).toString("base64");
  }

  toPublic() {
    const publicData = Object.keys(this.data)
      .filter((key) => !PrivateSharedStateKeys.includes(key))
      .reduce((acc, key) => {
        acc[key] = this.data[key];
        return acc;
      }, {} as SharedStateData);
    return new SharedState(
      publicData,
      this.authorisation,
      this.data.request_id as string,
    );
  }
}
