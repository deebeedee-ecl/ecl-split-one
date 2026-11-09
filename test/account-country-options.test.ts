import assert from "node:assert/strict";
import test from "node:test";
import { countryOptions, getCountryOption } from "../components/account/account-options";

test("nationality options include the approved ISO-based list", () => {
  const selectableCountries = countryOptions.slice(1);
  const codes = selectableCountries.map((country) => country.code);

  assert.equal(countryOptions[0]?.name, "Prefer not to say");
  assert.equal(selectableCountries.length, 247);
  assert.equal(new Set(codes).size, selectableCountries.length);
  assert.ok(codes.every((code) => /^[A-Z]{2}$/.test(code)));
  assert.ok(selectableCountries.every((country) => country.flag.length > 0));
  assert.equal(getCountryOption("HK"), null);
  assert.equal(getCountryOption("Hong Kong"), null);
  assert.equal(getCountryOption("TW"), null);
  assert.equal(getCountryOption("Taiwan"), null);
  assert.deepEqual(
    selectableCountries.map((country) => country.name),
    selectableCountries.map((country) => country.name).toSorted((a, b) => a.localeCompare(b, "en")),
  );
});

test("nationality options resolve Serbia by code and name", () => {
  assert.deepEqual(getCountryOption("RS"), {
    code: "RS",
    name: "Serbia",
    flag: "🇷🇸",
  });
  assert.equal(getCountryOption("serbia")?.code, "RS");
  assert.equal(getCountryOption("Turkey")?.code, "TR");
});
