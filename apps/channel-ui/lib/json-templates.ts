export interface JsonTemplate {
  label: string;
  value: Record<string, unknown>;
}

export interface JsonSnippet {
  label: string;
  value: Record<string, unknown>;
  targetArrayPath?: string;
}

export const coverageComponentTemplate: JsonTemplate = {
  label: "CoverageComponent Template",
  value: {
    coverageCode: "COLLISION",
    name: "Collision",
    description: "Coverage for collision damage",
    terms: [
      {
        termCode: "LIMIT",
        valueType: "MONEY",
      },
    ],
    deductibleOptions: [
      {
        code: "DED-1000",
        amount: 1000,
        currency: "SEK",
      },
    ],
    limitOptions: [
      {
        code: "LIM-50000",
        amount: 50000,
        currency: "SEK",
      },
    ],
    rules: [
      {
        ruleCode: "ELIGIBLE_PRIVATE",
        expression: "policyholder.type == 'PERSON'",
      },
    ],
  },
};

export const exposureComponentTemplate: JsonTemplate = {
  label: "ExposureComponent Template",
  value: {
    exposureType: "VEHICLE",
    requiredAttributes: ["vin", "make", "model", "year"],
    optionalAttributes: ["mileage", "usageType"],
    validationRules: [
      {
        ruleCode: "VIN_REQUIRED",
        expression: "exists(vin)",
      },
    ],
  },
};

export const ruleComponentTemplate: JsonTemplate = {
  label: "RuleComponent Template",
  value: {
    ruleCode: "AGE_ELIGIBILITY",
    description: "Applicant age rules",
    when: "applicant.age >= 18",
    then: {
      action: "ALLOW",
      reason: "Eligible",
    },
    else: {
      action: "DENY",
      reason: "Under minimum age",
    },
  },
};

export const pricingInputSchemaTemplate: JsonTemplate = {
  label: "Pricing Input Schema Template",
  value: {
    type: "object",
    properties: {
      requestId: { type: "string" },
      productVersionId: { type: "string" },
      currency: { type: "string", enum: ["SEK", "DKK", "EUR", "GBP", "USD", "NOK"] },
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            riskType: { type: "string" },
            riskKey: { type: ["string", "null"] },
            attributes: { type: "object" },
          },
          required: ["riskType", "attributes"],
        },
      },
      coverages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            coverageCode: { type: "string" },
            terms: { type: "array" },
          },
          required: ["coverageCode"],
        },
      },
    },
    required: ["requestId", "productVersionId", "currency", "risks", "coverages"],
  },
};

export const pricingOutputSchemaTemplate: JsonTemplate = {
  label: "Pricing Output Schema Template",
  value: {
    type: "object",
    properties: {
      requestId: { type: "string" },
      resultVersion: { type: "string" },
      totals: {
        type: "object",
        properties: {
          totalPremium: { type: "string" },
          currency: { type: "string" },
        },
        required: ["totalPremium", "currency"],
      },
      breakdown: {
        type: "array",
        items: {
          type: "object",
          properties: {
            coverageCode: { type: "string" },
            amount: { type: "string" },
          },
        },
      },
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    required: ["requestId", "resultVersion", "totals", "errors"],
  },
};

export const snippetInsertTerm: JsonSnippet = {
  label: "Insert Term object",
  value: {
    termCode: "LIMIT",
    valueType: "MONEY",
    moneyAmount: 50000,
    moneyCurrency: "SEK",
  },
  targetArrayPath: "terms",
};

export const snippetInsertDeductibleOption: JsonSnippet = {
  label: "Insert Deductible option",
  value: {
    code: "DED-2000",
    amount: 2000,
    currency: "SEK",
  },
  targetArrayPath: "deductibleOptions",
};

export const snippetInsertLimitOption: JsonSnippet = {
  label: "Insert Limit option",
  value: {
    code: "LIM-100000",
    amount: 100000,
    currency: "SEK",
  },
  targetArrayPath: "limitOptions",
};

export const snippetInsertRule: JsonSnippet = {
  label: "Insert Rule",
  value: {
    ruleCode: "NEW_RULE",
    expression: "true",
  },
  targetArrayPath: "rules",
};

export const componentSnippets: ReadonlyArray<JsonSnippet> = [
  snippetInsertTerm,
  snippetInsertDeductibleOption,
  snippetInsertLimitOption,
  snippetInsertRule,
];
