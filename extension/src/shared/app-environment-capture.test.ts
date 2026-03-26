import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { captureAppEnvironment } from "./app-environment-capture";

describe("captureAppEnvironment", () => {
  it("returns undefined when no signals", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      url: "https://exemplo.test/",
    });
    expect(captureAppEnvironment(dom.window as unknown as Window)).toBeUndefined();
  });

  it("reads meta application-name and build-id", () => {
    const html = `<!doctype html><html><head>
      <meta name="application-name" content="My App">
      <meta name="build-id" content="build-42">
    </head><body></body></html>`;
    const dom = new JSDOM(html, { url: "https://exemplo.test/" });
    const env = captureAppEnvironment(dom.window as unknown as Window);
    expect(env?.appName).toBe("My App");
    expect(env?.buildId).toBe("build-42");
  });

  it("reads __NEXT_DATA__.buildId without dumping the full object", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      url: "https://exemplo.test/",
    });
    const w = dom.window as unknown as Window & { __NEXT_DATA__?: unknown };
    (w as unknown as Record<string, unknown>)["__NEXT_DATA__"] = {
      buildId: "next-abc",
      props: { pageProps: { huge: "x".repeat(5000) } },
    };
    const env = captureAppEnvironment(w);
    expect(env?.buildId).toBe("next-abc");
    expect(JSON.stringify(env).length).toBeLessThan(500);
  });

  it("reads allowlist storage keys only", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      url: "https://exemplo.test/",
    });
    dom.window.localStorage.setItem("environment", "staging");
    dom.window.localStorage.setItem("ignored-key", "secret");
    const env = captureAppEnvironment(dom.window as unknown as Window);
    expect(env?.environmentName).toBe("staging");
    expect(JSON.stringify(env)).not.toContain("secret");
  });

  it("maps meta feature-flag-* to featureFlags", () => {
    const html = `<!doctype html><html><head>
      <meta name="feature-flag-dark" content="on">
    </head><body></body></html>`;
    const dom = new JSDOM(html, { url: "https://exemplo.test/" });
    const env = captureAppEnvironment(dom.window as unknown as Window);
    expect(env?.featureFlags?.some((f) => f.key === "dark" && f.value === "on")).toBe(true);
  });

  it("reads __APP_CONFIG__ scalars only", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      url: "https://exemplo.test/",
    });
    (dom.window as unknown as Record<string, unknown>)["__APP_CONFIG__"] = {
      appName: "CfgApp",
      tenant: "t-1",
      nested: { shouldNotAppear: "no" },
    };
    const env = captureAppEnvironment(dom.window as unknown as Window);
    expect(env?.appName).toBe("CfgApp");
    expect(env?.tenant).toBe("t-1");
    expect(JSON.stringify(env)).not.toContain("shouldNotAppear");
  });

  it("reads top-level __INITIAL_STATE__ scalars only", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      url: "https://exemplo.test/",
    });
    (dom.window as unknown as Record<string, unknown>)["__INITIAL_STATE__"] = {
      environment: "prod",
      auth: { token: "must-not-traverse" },
    };
    const env = captureAppEnvironment(dom.window as unknown as Window);
    expect(env?.environmentName).toBe("prod");
    expect(JSON.stringify(env)).not.toContain("must-not-traverse");
  });
});
