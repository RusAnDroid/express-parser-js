"use strict";

function createFunction(func) {
    return (...args) => {
        return (...variables) => {
            let funcArgs = [];
            for (let arg of args) {
                funcArgs.push(arg(...variables));
            }
            return func(...funcArgs);
        }
    }
}

function cnst(value) {
    return () => {
        return value;
    }
}

function variable(str) {
    return (x, y, z) => {
        switch (str) {
            case "x":
                return x;
            case "y":
                return y;
            case "z":
                return z;
        }
    }
}

const add = createFunction((a, b) => a + b);
const subtract = createFunction((a, b) => a - b);
const multiply = createFunction((a, b) => a * b);
const divide = createFunction((a, b) => a / b);
const negate = createFunction((a) => -a);

const madd = createFunction((a, b, c) => a * b + c);
const floor = createFunction(Math.floor);
const ceil = createFunction(Math.ceil);

const one = cnst(1);
const two = cnst(2);

function parse(str) {
    const tokens = str.trim().split(' ').filter(el => el !== "");
    const operators = {
        "+": [2, add],
        "-": [2, subtract],
        "*": [2, multiply],
        "/": [2, divide],
        "negate": [1, negate],
        "x": [0, () => variable("x")],
        "y": [0, () => variable("y")],
        "z": [0, () => variable("z")],
        "one": [0, () => one],
        "two": [0, () => two],
        "*+": [3, madd],
        "_": [1, floor],
        "^": [1, ceil]
    }

    let stack = [];
    for (let token of tokens) {
        if (token in operators) {
            let args = [];
            for (let i = 0; i < operators[token][0]; i++) {
                args.push(stack.pop());
            }
            args.reverse();
            stack.push(operators[token][1](...args));
            continue;
        }
        stack.push(cnst(Number(token)));
    }
    return stack.pop();
}

function test() {
    let expr = add(
        subtract(
            multiply(variable("x"), variable("x")),
            multiply(cnst(2), variable("x"))
        ),
        cnst(1)
    );
    let result = [];
    for (let x = 0; x <= 10; x++) {
        result.push(expr(x));
    }
    return result;
}