import type { Request, Response } from "express";

export function fakeReq(overrides: Record<string, unknown> = {}): Request {
  return { session: {}, ...overrides } as unknown as Request;
}

export interface FakeResponse extends Response {
  statusCode: number;
  jsonBody: unknown;
  headers: Record<string, string>;
}

interface MutableFakeResponse {
  statusCode: number;
  jsonBody: unknown;
  headers: Record<string, string>;
  status(code: number): MutableFakeResponse;
  json(body: unknown): MutableFakeResponse;
  setHeader(name: string, value: string): MutableFakeResponse;
}

export function fakeRes(): FakeResponse {
  const res: MutableFakeResponse = {
    statusCode: 200,
    jsonBody: undefined,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.jsonBody = body;
      return res;
    },
    setHeader(name, value) {
      res.headers[name] = value;
      return res;
    },
  };
  return res as unknown as FakeResponse;
}
