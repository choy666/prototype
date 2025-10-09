"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/seedProducts.ts
var db_1 = require("../lib/db");
var schema_1 = require("../lib/schema");
function seedProducts() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db.insert(schema_1.products).values([
                        {
                            name: "Camiseta básica",
                            description: "Camiseta de algodón 100% en varios colores",
                            price: "19.99",
                            image: "https://example.com/images/camiseta.jpg",
                            category: "Ropa",
                            destacado: false,
                            stock: 50,
                        },
                        {
                            name: "Pantalón jeans",
                            description: "Jeans azul clásico, corte recto",
                            price: "39.90",
                            image: "https://example.com/images/jeans.jpg",
                            category: "Ropa",
                            destacado: true,
                            stock: 30,
                        },
                        {
                            name: "Zapatillas deportivas",
                            description: "Zapatillas ligeras para correr",
                            price: "59.95",
                            image: "https://example.com/images/zapatillas.jpg",
                            category: "Calzado",
                            destacado: true,
                            stock: 20,
                        },
                        {
                            name: "Mochila urbana",
                            description: "Mochila resistente al agua con múltiples compartimentos",
                            price: "45.00",
                            image: "https://example.com/images/mochila.jpg",
                            category: "Accesorios",
                            destacado: false,
                            stock: 15,
                        },
                        {
                            name: "Reloj digital",
                            description: "Reloj resistente al agua con cronómetro",
                            price: "25.50",
                            image: "https://example.com/images/reloj.jpg",
                            category: "Accesorios",
                            destacado: false,
                            stock: 40,
                        },
                        {
                            name: "Auriculares Bluetooth",
                            description: "Auriculares inalámbricos con cancelación de ruido",
                            price: "79.99",
                            image: "https://example.com/images/auriculares.jpg",
                            category: "Electrónica",
                            destacado: true,
                            stock: 25,
                        },
                        {
                            name: "Smartphone X1",
                            description: "Pantalla 6.5\" AMOLED, 128GB almacenamiento",
                            price: "299.00",
                            image: "https://example.com/images/smartphone.jpg",
                            category: "Electrónica",
                            destacado: true,
                            stock: 10,
                        },
                        {
                            name: "Teclado mecánico",
                            description: "Teclado mecánico retroiluminado RGB",
                            price: "89.90",
                            image: "https://example.com/images/teclado.jpg",
                            category: "Electrónica",
                            destacado: false,
                            stock: 35,
                        },
                        {
                            name: "Silla ergonómica",
                            description: "Silla de oficina con soporte lumbar ajustable",
                            price: "149.00",
                            image: "https://example.com/images/silla.jpg",
                            category: "Muebles",
                            destacado: true,
                            stock: 12,
                        },
                        {
                            name: "Lámpara LED",
                            description: "Lámpara de escritorio con luz regulable",
                            price: "22.75",
                            image: "https://example.com/images/lampara.jpg",
                            category: "Muebles",
                            destacado: false,
                            stock: 60,
                        },
                    ])];
                case 1:
                    _a.sent();
                    console.log("✅ 10 productos insertados correctamente");
                    return [2 /*return*/];
            }
        });
    });
}
seedProducts()
    .then(function () { return process.exit(0); })
    .catch(function (err) {
    console.error("❌ Error al insertar productos:", err);
    process.exit(1);
});
