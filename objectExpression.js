"use strict";

function Const(value) {
    this._value = value;
    this.evaluate = function() {
        return this._value;
    }
    this.toString = function() {
        return "" + this._value;
    }
    this.diff = function() {
        return new Const(0);
    }
    this.prefix = function() {
        return this.toString();
    }
    this.postfix = function() {
        return this.toString();
    }
}
Const.prototype = Object.create(AbstractExpression.prototype);
Const.prototype.constructor = Const;
Const.prototype.name = "Const";

function Variable(name) {
    this._name = name;
    this.evaluate = function(x, y, z) {
        switch (this._name) {
            case "x":
                return x;
            case "y":
                return y;
            case "z":
                return z;
        }
    }
    this.toString = function() {
        return this._name;
    }
    this.diff = function(variableName) {
        if (variableName === this._name) {
            return new Const(1);
        }
        return new Const(0);
    }
    this.prefix = function() {
        return this.toString();
    }
    this.postfix = function() {
        return this.toString();
    }
}
Variable.prototype = Object.create(AbstractExpression.prototype);
Variable.prototype.constructor = Variable;
Variable.prototype.name = "Variable";

function AbstractExpression(...args) {
    this._args = args
    this.evaluate = function(...variables) {
        let evaluatedArgs = this._args.map((_arg) => _arg.evaluate(...variables));
        return this.makeOperation(...evaluatedArgs);
    }
    this.toString = function() {
        let result = this._args.map((_arg) => _arg.toString()).join(" ");
        return `${result} ${this.getOperationSign()}`;
    }
    this.diff = function(variableName) {
        return this.getDiffExpression(...this._args.map((_arg) => _arg.diff(variableName)));
    }
    this.prefix = function() {
        let result = this._args.map((_arg) => _arg.prefix()).join(" ");
        return `(${this.getOperationSign()} ${result})`;
    }
    this.postfix = function() {
        let result = this._args.map((_arg) => _arg.postfix()).join(" ");
        return `(${result} ${this.getOperationSign()})`;
    }
}

function buildAbstractExpression(operationSign, operationFunction, diffFunction, name) {
    let result = function(...args) {
        AbstractExpression.call(this, ...args);
        this.makeOperation = operationFunction;
        this.getOperationSign = function() {
            return operationSign;
        }
        this.getDiffExpression = diffFunction;
    }
    result.prototype = Object.create(AbstractExpression.prototype);
    result.prototype.constructor = result;
    result.prototype.name = name;
    return result;
}

let Negate = buildAbstractExpression(
    "negate", 
    (operand) => -operand,
    (diffedOperand) => new Negate(diffedOperand),
    "Negate"
);

let Add = buildAbstractExpression(
    "+", 
    (leftSide, rightSide) => leftSide + rightSide,
    (diffedLeftSide, diffedRightSide) => new Add(diffedLeftSide, diffedRightSide),
    "Add"
);

let Subtract = buildAbstractExpression(
    "-", 
    (leftSide, rightSide) => leftSide - rightSide,
    (diffedLeftSide, diffedRightSide) => new Subtract(diffedLeftSide, diffedRightSide),
    "Subtract"
); 

let Multiply = buildAbstractExpression(
    "*", 
    (leftSide, rightSide) => leftSide * rightSide,
    function(diffedLeftSide, diffedRightSide) {
        return new Add(
            new Multiply(this._args[0], diffedRightSide),
            new Multiply(diffedLeftSide, this._args[1])
        );
    },
    "Multiply"
); 

let Divide = buildAbstractExpression(
    "/", 
    (leftSide, rightSide) => leftSide / rightSide,
    function(diffedLeftSide, diffedRightSide) {
        return new Divide(
            new Subtract(
                new Multiply(diffedLeftSide, this._args[1]),
                new Multiply(this._args[0], diffedRightSide)
            ),
            new Multiply(this._args[1], this._args[1])
        );
    },
    "Divide"
);


function countSumExp(...args) {
    return args.reduce((accumulator, arg) => accumulator + Math.exp(arg), 0);
}

function getDiffedSumExpExpression(args, diffedArgs) {
    return args.slice(1).reduce((accumulator, arg, i) => new Add(
        accumulator, 
        new Multiply(new Sumexp(arg), diffedArgs[i + 1])
    ), new Multiply(new Sumexp(args[0]), diffedArgs[0]));
}

let Sumexp = buildAbstractExpression(
    "sumexp",
    countSumExp,
    function(...diffedArgs) {
        return getDiffedSumExpExpression(this._args, diffedArgs);
    },
    "Sumexp"
)

let LSE = buildAbstractExpression(
    "lse",
    (...args) => Math.log(countSumExp(...args)),
    function(...diffedArgs) {
        return new Divide(
            getDiffedSumExpExpression(this._args, diffedArgs),
            new Sumexp(...this._args)
        );
    },
    "LSE"
)


const NUMBER_OF_NEXT_TOKENS = 7;

function ParsingError(message) {
    Error.call(this, message);
    this.message = `Parsing error occured: ${message}.`;
    this.name = "ParsingError";
}
ParsingError.prototype = Object.create(Error.prototype);
ParsingError.prototype.name = "ParsingError";
ParsingError.prototype.constructor = ParsingError;

function buildParsingError(getMessage, name) {
    let result = function(...args) {
        this.message = getMessage(...args);
        ParsingError.call(this, this.message);
        this.name = name;
    }
    result.prototype = Object.create(ParsingError.prototype);
    result.prototype.constructor = result;
    result.prototype.name = name;
    return result;
}

let UnexpectedEndOfExpressionError = buildParsingError(
    (expectedToken) => `Expected '${expectedToken}', got end of ecpression.`,
    "UnexpectedEndOfExpressionError"
);

let AnotherTokenExpectedError = buildParsingError(
    (expectedToken, errorToken, tokensSuffix) =>  {
        return `Unexpected token: expected ${expectedToken}, got '${errorToken}'. In: -> ${tokensSuffix.slice(0, NUMBER_OF_NEXT_TOKENS).join(" ")}`;
    },
    "AnotherTokenExpectedError"
);

let UnexpectedTokenError = buildParsingError(
    (errorToken, tokensSuffix) =>  {
        return `Unexpected token: '${errorToken}'. In: -> ${errorToken} ${tokensSuffix.slice(0, NUMBER_OF_NEXT_TOKENS).join(" ")}`;
    },
    "AnotherTokenExpectedError"
);

let WrongNumberOfArgumentsError = buildParsingError(
    (expectedNumber, gotNumber, tokensSuffix) =>  {
        return `Worng number of arguments: expected ${expectedNumber}, got ${gotNumber}. In: -> ${tokensSuffix.slice(0, NUMBER_OF_NEXT_TOKENS).join(" ")}`;
    },
    "WrongNumberOfArgumentsError"
);

const operators = new Map([
    ["+", [2, (leftSide, rightSide) => new Add(leftSide, rightSide)]],
    ["-", [2, (leftSide, rightSide) => new Subtract(leftSide, rightSide)]],
    ["*", [2, (leftSide, rightSide) => new Multiply(leftSide, rightSide)]],
    ["/", [2, (leftSide, rightSide) => new Divide(leftSide, rightSide)]],
    ["negate", [1, (operand) => new Negate(operand)]],
    ["sumexp", [-1, (...args) => new Sumexp(...args)]],
    ["lse", [-1, (...args) => new LSE(...args)]],
    ["sumsq2", [2, (...args) => new Sumsq2(...args)]],
    ["sumsq3", [3, (...args) => new Sumsq3(...args)]],
    ["sumsq4", [4, (...args) => new Sumsq4(...args)]],
    ["sumsq5", [5, (...args) => new Sumsq5(...args)]],
    ["distance2", [2, (...args) => new Distance2(...args)]],
    ["distance3", [3, (...args) => new Distance3(...args)]],
    ["distance4", [4, (...args) => new Distance4(...args)]],
    ["distance5", [5, (...args) => new Distance5(...args)]],
]);

const variables = new Map([
    ["x", () => new Variable("x")],
    ["y", () => new Variable("y")],
    ["z", () => new Variable("z")],
]);

function getSplittedString(str) {
    str = str.replaceAll("(", " ( ");
    str = str.replaceAll(")", " ) ");
    return str.trim().split(' ').filter(el => el !== "");
}

function parseElement(tokensSuffix, bracketsParsingFunction) {
    let token = tokensSuffix.shift();
    if (variables.has(token)) {
        return variables.get(token)();
    }
    if (!isNaN(token)) {
        return new Const(Number(token));
    }
    if (token === "(") {
        return bracketsParsingFunction(tokensSuffix);
    }
    throw new UnexpectedTokenError(token, tokensSuffix);
}

function checkLength(tokensSuffix) {
    if (tokensSuffix.length === 0) {
        throw new UnexpectedEndOfExpressionError(")");
    }
    if (tokensSuffix[0] !== ")") {
        throw new AnotherTokenExpectedError(")", tokensSuffix[0], tokensSuffix);
    }
}

function parsePrefixBrackets(tokensSuffix) {
    let operator = tokensSuffix.shift();
    if (!operators.has(operator)) {
        throw new UnexpectedTokenError(operator, tokensSuffix);
    }

    let numberOfArguments = operators.get(operator)[0];
    let args = [];
    if (numberOfArguments > -1) {
        for (let i = 0; i < numberOfArguments; i++) {
            args.push(parseElement(tokensSuffix, parsePrefixBrackets));
        }
    } else {
        while (tokensSuffix.length > 0 && tokensSuffix[0] !== ")") {
            args.push(parseElement(tokensSuffix, parsePrefixBrackets));
        }
    }

    checkLength(tokensSuffix);

    tokensSuffix.shift();

    return operators.get(operator)[1](...args);;
}

function parsePostfixBrackets(tokensSuffix) {
    let token = tokensSuffix[0];
    let args = [];
    while (tokensSuffix.length > 0 && !operators.has(token)) {
        args.push(parseElement(tokensSuffix, parsePostfixBrackets));
        token = tokensSuffix[0];
    }
    
    let numberOfArguments = operators.get(token)[0];

    if (numberOfArguments > 0 && args.length !== numberOfArguments) {
        throw new WrongNumberOfArgumentsError(numberOfArguments, args.length, tokensSuffix);
    }

    tokensSuffix.shift();

    checkLength(tokensSuffix);

    tokensSuffix.shift();

    return operators.get(token)[1](...args);
}

function buildParsingFunction(bracketsParsingFunction) {
    return (str) => {
        const tokens = getSplittedString(str);
        let result = parseElement(tokens, bracketsParsingFunction);
        if (tokens.length > 0) {
            throw new ParsingError("Expresstion isn't wrapped with external brackets");
        }
        return result;
    }
}

let parsePrefix = buildParsingFunction(parsePrefixBrackets);
let parsePostfix = buildParsingFunction(parsePostfixBrackets);

function countSumSq(...args) {
  return args.reduce((accumulator, arg) => accumulator + arg * arg, 0);
}

function getDiffedSumSqExpression(args, diffedArgs) {
  let rightSide = diffedArgs.slice(2).reduce(
      (accumulator, diffedArg, i) => new Add(
          accumulator, 
          new Multiply(args[i + 2], diffedArg)
      ), 
      new Add(
          new Multiply(args[0], diffedArgs[0]),
          new Multiply(args[1], diffedArgs[1])
      )
  );
  return new Multiply(new Const(2), rightSide);
}

function buildSumsqN(n) {
  return buildAbstractExpression(
      "sumsq" + n, 
      countSumSq,
      function(...diffedArgs) {
          return getDiffedSumSqExpression(this._args, diffedArgs);
      }
  );
}

let Sumsq2 = buildSumsqN(2);
let Sumsq3 = buildSumsqN(3);
let Sumsq4 = buildSumsqN(4);
let Sumsq5 = buildSumsqN(5);

function buildDistanceN(n) {
  return buildAbstractExpression(
      "distance" + n, 
      (...args) => Math.sqrt(countSumSq(...args)),
      function(...diffedArgs) {
          return new Divide(
              getDiffedSumSqExpression(this._args, diffedArgs), 
              new Multiply(new Const(2), this)
          );
      }
  );  
}

let Distance2 = buildDistanceN(2);
let Distance3 = buildDistanceN(3);
let Distance4 = buildDistanceN(4);
let Distance5 = buildDistanceN(5);

function parse(str) {
  const tokens = str.trim().split(' ').filter(el => el !== "");

  let stack = [];
  for (let token of tokens) {
      if (operators.has(token)) {
          stack.push(operators.get(token)[1](
              ...stack.splice(
                  stack.length - operators.get(token)[0], 
                  operators.get(token)[0])
              )
          );
          continue;
      }
      if (variables.has(token)) {
        stack.push(variables.get(token)());
        continue;
      }
      stack.push(new Const(Number(token)));
  }
  return stack.pop();
}