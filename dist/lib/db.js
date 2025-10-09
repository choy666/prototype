"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.dbUtils = exports.db = void 0;
exports.checkDatabaseConnection = checkDatabaseConnection;
// lib/db.ts
var serverless_1 = require("@neondatabase/serverless");
var neon_http_1 = require("drizzle-orm/neon-http");
var schema = require("./schema");
var drizzle_orm_1 = require("drizzle-orm");
var zod_1 = require("zod");
// 1. Validación de variables de entorno
var envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url('DATABASE_URL debe ser una URL válida'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
});
var env = envSchema.safeParse(process.env);
if (!env.success) {
    console.error('❌ Error en la configuración del entorno:', env.error.format());
    throw new Error('Error en la configuración del entorno');
}
// 3. Configuración de la conexión
var createDrizzleClient = function () {
    try {
        var client = (0, serverless_1.neon)(env.data.DATABASE_URL, {
            fullResults: true,
        });
        return (0, neon_http_1.drizzle)(client, {
            schema: schema,
            logger: env.data.NODE_ENV === 'development'
                ? {
                    logQuery: function (query, params) {
                        console.log('📝 Query:', query);
                        if (params === null || params === void 0 ? void 0 : params.length) {
                            console.log('   Params:', params);
                        }
                    },
                }
                : false,
        });
    }
    catch (error) {
        console.error('❌ Error al crear el cliente de base de datos:', error);
        throw new Error('No se pudo conectar a la base de datos');
    }
};
// 4. Singleton unificado (dev y prod)
var getDrizzleClient = function () {
    if (!globalThis.drizzleClient) {
        console.log(env.data.NODE_ENV === 'development'
            ? '🔌 Creando nueva conexión a la base de datos para desarrollo...'
            : '🚀 Inicializando cliente de base de datos en producción...');
        globalThis.drizzleClient = createDrizzleClient();
    }
    return globalThis.drizzleClient;
};
// 5. Exportar la instancia de la base de datos
exports.db = getDrizzleClient();
// 7. Funciones útiles
exports.dbUtils = {
    and: drizzle_orm_1.and,
    or: drizzle_orm_1.or,
    eq: drizzle_orm_1.eq,
    ne: drizzle_orm_1.ne,
    gt: drizzle_orm_1.gt,
    gte: drizzle_orm_1.gte,
    lt: drizzle_orm_1.lt,
    lte: drizzle_orm_1.lte,
    like: drizzle_orm_1.like,
    inArray: drizzle_orm_1.inArray,
    isNull: drizzle_orm_1.isNull,
    sql: drizzle_orm_1.sql,
};
// 8. Función para verificar la conexión
function checkDatabaseConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["SELECT 1"], ["SELECT 1"])))];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { success: true, message: '✅ Conexión a la base de datos exitosa' }];
                case 2:
                    error_1 = _a.sent();
                    console.error('❌ Error al conectar a la base de datos:', error_1);
                    return [2 /*return*/, {
                            success: false,
                            message: 'Error al conectar a la base de datos',
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
var templateObject_1;
