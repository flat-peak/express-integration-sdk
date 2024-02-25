import { FlatpeakModule } from "@flat-peak/javascript-sdk";

import type { AppParams, SharedStateData } from "../index";

class AuthMetadataModule extends FlatpeakModule {
  save(credentials: Record<string, string>) {
    return this.processRequest(
      this.performSignedRequest(`${this.host}/auth_metadatas`, {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    );
  }

  addToSession(auth_metadata_id: string, session_id: string) {
    return this.processRequest(
      this.performSignedRequest(`${this.host}/v1`, {
        method: "POST",
        body: JSON.stringify({
          route: "auth_metadata_capture",
          type: "submit",
          session_id,
          data: { auth_metadata: { id: auth_metadata_id } },
        }),
      }),
    );
  }
}

export async function storeAuthMetadata(
  credentials: Record<string, string>,
  state: SharedStateData,
  appParams: AppParams,
) {
  const { api_url, logger } = appParams;
  const { publishable_key } = state;

  const authMetadataModule = new AuthMetadataModule(
    {
      host: api_url,
      publishableKey: publishable_key,
      secretKey: "",

      logger: (message) => {
        if (logger) {
          logger.info(`[AUTH_METADATA] ${message}`);
        }
      },
    },
    {},
  );

  const data = await authMetadataModule.save(credentials);
  return data.id;
}
export async function submitAuthMetadata(
  state: SharedStateData,
  appParams: AppParams,
) {
  const { api_url, logger } = appParams;
  const { publishable_key } = state;

  const authMetadataModule = new AuthMetadataModule(
    {
      host: api_url,
      publishableKey: publishable_key,
      secretKey: "",

      logger: (message) => {
        if (logger) {
          logger.info(`[AUTH_METADATA] ${message}`);
        }
      },
    },
    {},
  );

  const result = await authMetadataModule.addToSession(
    state.auth_metadata_id || "",
    state.session_id,
  );

  return result;
}
