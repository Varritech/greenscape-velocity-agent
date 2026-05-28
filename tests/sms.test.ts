import { describe, it, expect, beforeEach } from "vitest";
import { composeOpener, SMS_MAX_LEN } from "@/lib/sms-copy";
import {
  sendQualifiedLeadSMS,
  SmsError,
  __setTwilioClientForTests,
} from "@/lib/sms";

describe("composeOpener", () => {
  it("includes the first name when present", () => {
    const body = composeOpener({
      leadFirstName: "Daniel",
      source: "Google LSA",
      suggestedNextAction: "ask about budget and lot dimensions",
    });
    expect(body.startsWith("Hey Daniel")).toBe(true);
  });

  it("falls back to a bare greeting when name is missing", () => {
    const body = composeOpener({
      leadFirstName: "",
      source: "Google LSA",
      suggestedNextAction: "ask about budget",
    });
    expect(body.startsWith("Hey,")).toBe(true);
  });

  it("strips the 'SMS within Ns' instruction prefix from suggested_next_action", () => {
    const body = composeOpener({
      leadFirstName: "Sarah",
      source: "Facebook",
      suggestedNextAction: "SMS within 60s with three site-walk windows this week",
    });
    expect(body).not.toMatch(/sms within/i);
    expect(body).toMatch(/three site-walk windows/);
  });

  it("uses the 'thanks for reaching out' tag when source is a Referral", () => {
    const body = composeOpener({
      leadFirstName: "Mike",
      source: "Referral",
      suggestedNextAction: "offer a site walk this week",
    });
    expect(body).toMatch(/thanks for reaching out/);
  });

  it("truncates to SMS_MAX_LEN", () => {
    const body = composeOpener({
      leadFirstName: "X",
      source: "Web",
      suggestedNextAction: "a".repeat(500),
    });
    expect(body.length).toBeLessThanOrEqual(SMS_MAX_LEN);
  });
});

describe("sendQualifiedLeadSMS", () => {
  beforeEach(() => {
    process.env.TWILIO_FROM_NUMBER = "+14805550100";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
  });

  it("calls twilio.messages.create with to/from/body and returns sid+status", async () => {
    let lastArgs: { to: string; from: string; body: string } | null = null;
    const fake = {
      messages: {
        create: async (args: { to: string; from: string; body: string }) => {
          lastArgs = args;
          return { sid: "SMxxx", status: "queued" };
        },
      },
    };
    __setTwilioClientForTests(fake as unknown as Parameters<typeof __setTwilioClientForTests>[0]);

    const out = await sendQualifiedLeadSMS({
      phone: "+14805550101",
      leadFirstName: "Daniel",
      source: "Google LSA",
      suggestedNextAction: "offer three site-walk windows this week",
    });

    expect(out.sid).toBe("SMxxx");
    expect(out.status).toBe("queued");
    expect(lastArgs!.to).toBe("+14805550101");
    expect(lastArgs!.from).toBe("+14805550100");
    expect(lastArgs!.body).toMatch(/Daniel/);
  });

  it("throws SmsError on non-E.164 phone", async () => {
    await expect(
      sendQualifiedLeadSMS({
        phone: "480-555-0101",
        leadFirstName: "x",
        source: "x",
        suggestedNextAction: "x",
      }),
    ).rejects.toThrow(SmsError);
  });

  it("wraps twilio errors as SmsError", async () => {
    const fake = {
      messages: {
        create: async () => {
          throw new Error("network");
        },
      },
    };
    __setTwilioClientForTests(fake as unknown as Parameters<typeof __setTwilioClientForTests>[0]);

    await expect(
      sendQualifiedLeadSMS({
        phone: "+14805550101",
        leadFirstName: "x",
        source: "x",
        suggestedNextAction: "x",
      }),
    ).rejects.toThrow(SmsError);
  });
});
