// Lemo-Opuscar woodcut motoru için TS sarmalayıcı (motor düz JS; tipler bilerek gevşek).
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-ignore
import * as WCjs from "./engine/index.js";
// @ts-ignore
import { Sculpt as SculptJs } from "./sculpt.js";
// @ts-ignore
import * as TRjs from "./trans.js";
export const WC: any = WCjs;
export const Sculpt: any = SculptJs;
export const TR: any = TRjs;
