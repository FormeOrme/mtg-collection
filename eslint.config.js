export default [
    {
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector: "CallExpression[callee.property.name='forEach']",
                    message: "Use for-of instead of .forEach()",
                },
            ],
        },
    },
];
