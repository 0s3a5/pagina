import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { engine } from 'express-handlebars';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLAVE_SECRETA = process.env.CLAVE_SECRETA || 'sedavueltaelsemestre123';
const AUTH_COOKIE_NAME = 'segurida';
const sql = neon(process.env.DATABASE_URL || 'postgresql://pagina_owner:ACPjs2Bh7ovH@ep-royal-meadow-a5sckxt7.us-east-2.aws.neon.tech/pagina?sslmode=require');

import session from 'express-session';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public'))); // Asegúrate de que esta carpeta exista

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

//---------------------------------------------------------------------------registro y autenticacion = funcional
const authMiddleware = async (req, res, next) => {
  const token = req.cookies[AUTH_COOKIE_NAME];

  try {
    req.user = jwt.verify(token, CLAVE_SECRETA);
    const results = await sql('SELECT * FROM usuarios WHERE id = $1', [
      req.user.id,
    ]);
    req.user = results[0];
    req.user.salutation = `Hola ${req.user.name}`;
    next();
  } catch (e) 
  {
    res.render('login');
  }
};

app.use(session({
  secret: 'tu_secreto_para_firmar_las_sesiones',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true } 
}));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});

app.post("/usuarios", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const queryCheck = "SELECT * FROM usuarios WHERE email = $1";
  const result = await sql(queryCheck, [email]);
  if (result.length > 0) 
  {
    res.render("registrarse", { error: "El nombre de email ya está en uso." });
  } 
  else {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const query = "INSERT INTO usuarios (rango, email, password, dinero) VALUES ($1, $2, $3, $4)";
    await sql(query, [1, email, hashedPassword, 5000]);

    res.redirect("login");
  }
});
//---------------------------------------------------------------------------homes = funcional
app.get('/', async (req, res) => {
  const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM anime");
  res.render("home", {lista, lista2});
});

app.get("/home", async (req,res) => {
  const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM anime");
  res.render("home", {lista, lista2});
});

app.get("/homeuser", async (req,res) => {
  const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM anime");
  res.render("homeuser", {lista, lista2});
});

app.get("/homeADMIN",authMiddleware, async (req,res) => {
 const lista = await sql ("SELECT * FROM producto");
  const lista2 = await sql ("SELECT * FROM anime");
  const resultado = await sql("SELECT SUM(costo) AS total FROM boleta");
  const total = resultado[0].total;
  res.render("homeADMIN", {lista, lista2, total});
});

//---------------------------------------------------------------------------carrito = en proceso


//---------------------------------------------------------------------------direccionadores = funcional
app.get("/direccionador",authMiddleware, async (req,res) => {
   const user = req.user;
   res.render("direccionador", user);
 });
 app.get("/direccionadorr",authMiddleware, async (req,res) => {
  const user = req.user;
  res.render("direccionadorr", user);
});
 
//---------------------------------------------------------------------------wallet = en proceso
app.get('/wallet', authMiddleware, async (req, res) => {
  const user = req.user;
    res.render('wallet', user);
});

//---------------------------------------------------------------------------pantalla sesion = funcional
app.get('/sesionuser', authMiddleware, async (req, res) => {
  const user = req.user;
    res.render('sesionuser', user);
});

//---------------------------------------------------------------------------cambiar foto = funcional
app.get('/fotoperfil', authMiddleware, async (req, res) => {
  const user = req.user;
    res.render('fotoperfil', {user});
});

//---------------------------------------------------------------------------pantalla de armas = funcional
app.get("/pantallaarma", async (req, res) => {
  const id = req.query.paginaid;
  const result = await sql('SELECT * FROM producto WHERE id = $1', [id]);
  const producto = result[0];
  res.render("pantallaarma", { producto });
});

app.get("/pantallaobjeto", async (req, res) => {
  const id = req.query.paginaid;
  const result = await sql('SELECT * FROM anime WHERE id = $1', [id]);
  const producto = result[0];
  res.render("pantallaobjeto", { producto });
});

//---------------------------------------------------------------------------cambiar foto perfil = funcional
app.post('/actualizarfoto', authMiddleware, async (req, res) => {
  const user = req.user;
  const datosActualizados = {
    link_imagen_perfil: req.body.link_imagen_perfil
};


  await actualizarfoto(user.id, datosActualizados);
  res.redirect('/direccionadorr');
});

async function actualizarfoto(id, datos) {
  try {
      await sql(
          `UPDATE usuarios
           SET link_imagen_perfil = $1
           WHERE id = $2`,
           
          [
              datos.link_imagen_perfil,
              id
          ]
      );
  } catch (error) {
      console.error("Error al cambiar foto:", error);
      throw error;
  }
}

//---------------------------------------------------------------------------cerrar sesion = funcional
app.get('/logout', (req, res) => {
  res.cookie(AUTH_COOKIE_NAME, '', { maxAge: 1 });
  res.render('direccionador');
});

//---------------------------------------------------------------------------iniciar sesion = funcional
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const query = 'SELECT id, password FROM usuarios WHERE email = $1';
  const results = await sql(query, [email]);
  if (results.length === 0) {
    res.redirect(302, '/login?error=unauthorized');
    return;
  }

  const id = results[0].id;
  const hash = results[0].password;

  if (bcrypt.compareSync(password, hash)) {
    const fiveMinutesFromNowInSeconds = Math.floor(Date.now() / 1000) + 5 * 60;
    const token = jwt.sign(
      { id, exp: fiveMinutesFromNowInSeconds },
      CLAVE_SECRETA
    );

    res.cookie(AUTH_COOKIE_NAME, token, { maxAge: 60 * 5 * 1000 });
    res.redirect(302, '/direccionador');
    return;
  }

  res.redirect('/login?error=unauthorized');
});

//---------------------------------------------------------------------------registrar sesion = funcional
app.get('/registrarse', (req, res) => {
  res.render('registrarse');
});

const generarToken = (datos) => jwt.sign(datos, CLAVE_SECRETA, { expiresIn: '1h' });



//---------------------------------------------------------------------------agregar objeto = funcional
app.get("/agregararma", async (req, res) => 
{
  res.render("agregararma");
});
app.get("/agregarobjeto", async (req, res) => 
{
  res.render("agregarobjeto");
});
app.post("/newproduct", async (req, res) => {
  const nombre = req.body.nombre;
  const description = req.body.description;
  const image = req.body.image;
  const image1 = req.body.image1;
  const image2 = req.body.image2;
  const image3 = req.body.image3;
  const price = req.body.price;
  const quantity = req.body.quantity;
 
    const query = "INSERT INTO producto (nombre, cantidad, precio, link_imagen, descripcion ) VALUES ($1, $2, $3, $4,$5)";
    await sql(query, [nombre, quantity, price, image, description]);

    res.redirect("direccionador");
  
});
app.post("/newproduct2", async (req, res) => {
  const nombre = req.body.nombre;
  const description = req.body.description;
  const image = req.body.image;
  const image1 = req.body.image1;
  const image2 = req.body.image2;
  const image3 = req.body.image3;
  const video = req.body.video;
  const datof = req.body.datof;
  const datos = req.body.datos;
  const price = req.body.price;
  const quantity = req.body.quantity;
 
    const query = "INSERT INTO anime (nombre, cantidad, precio, link_imagen_principal, link_imagen1, link_imagen2, link_imagen3, link_video, datof, datos, definicion) VALUES ($1, $2, $3, $4,$5,$6, $7, $8, $9, $10, $11)";
    await sql(query, [nombre, quantity, price, image, image1, image2, image3, video, datof, datos, description ]);

    res.redirect("direccionador");
  
});

//---------------------------------------------------------------------------editar arma = funcional
async function obtenerArmaPorId(id) {
  try {
      const resultado = await sql(`SELECT * FROM producto WHERE id = $1`, [id]);
      return resultado[0];
  } catch (error) {
      console.error("Error al obtener el arma:", error);
      throw error;
  }
}

app.get('/editararma', async (req, res) => {
  const armaId = req.query.id;
  const arma = await obtenerArmaPorId(armaId);
  res.render('editararma', { arma });
});

app.post('/actualizararma', async (req, res) => {
  const armaId = req.body.id;
  const datosActualizados = {
    nombre: req.body.nombre,
    definicion: req.body.definicion,
    link_imagen_principal: req.body.link_imagen_principal,
    link_imagen1: req.body.link_imagen1,
    link_imagen2: req.body.link_imagen2,
    link_imagen3: req.body.link_imagen3,
    link_video: req.body.link_video,
    datof: req.body.datof,
    datos: req.body.datos,
    precio: req.body.precio,
    cantidad: req.body.cantidad
};


  await actualizarArma(armaId, datosActualizados);
  res.redirect('/homeADMIN');
});


async function actualizarArma(id, datos) {
  try {
      await sql(
          `UPDATE producto
           SET nombre = $1, definicion = $2, link_imagen_principal = $3, link_imagen1 = $4, 
               link_imagen2 = $5, link_imagen3 = $6, link_video = $7, datof = $8, 
               datos = $9, precio = $10, cantidad = $11
                WHERE id = $12`,
          [
              datos.nombre,
              datos.definicion,
              datos.link_imagen_principal,
              datos.link_imagen1,
              datos.link_imagen2,
              datos.link_imagen3,
              datos.video,
              datos.datof,
              datos.datos,
              datos.precio,
              datos.cantidad,
              id
          ]
      );
  } catch (error) {
      console.error("Error al actualizar el arma:", error);
      throw error;
  }
}
//---------------------------------------------------------------------------eliminar arma = funcional
app.post('/eliminararma', async (req, res) => {
  const armaId = req.body.id;
  try {
    await eliminarArma(armaId); 
    res.redirect('/homeADMIN'); 
  } catch (error) {
    console.error("Error al eliminar el arma:", error);
    res.status(500).send('Ocurrió un error al intentar eliminar el producto.');
  }
});

async function eliminarArma(id) {
  try {
    await sql(`DELETE FROM producto WHERE id = $1`, [id]);
  } catch (error) {
    console.error("Error al eliminar el arma de la base de datos:", error);
    throw error;
  }
}



app.post('/eliminararmadef', async (req, res) => {
  const armaId = req.body.id;
  try {
    await eliminarArmaDef(armaId); 
    res.redirect('/homeADMIN'); 
  } catch (error) {
    console.error("Error al eliminar el arma:", error);
    res.status(500).send('Ocurrió un error al intentar eliminar el producto.');
  }
});


async function eliminarArmaDef(id) {
  try {
    await sql(`DELETE FROM productodef WHERE id = $1`, [id]);
  } catch (error) {
    console.error("Error al eliminar el arma de la base de datos:", error);
    throw error;
  }
}
//---------------------------------------------------------------------------editar producto = funcional
async function obtenerArmaPorIdDef(id) {
  try {
      const resultado = await sql(`SELECT * FROM anime WHERE id = $1`, [id]);
      return resultado[0]; 
  } catch (error) {
      console.error("Error al obtener el arma desde anime:", error);
      throw error;
  }
}
app.get('/editararmadef', async (req, res) => {
  const armaId = req.query.id;
  const arma = await obtenerArmaPorIdDef(armaId);
  res.render('editararmadef', { arma });
});
app.post('/actualizararmadef', async (req, res) => {
  const armaId = req.body.id;
  const datosActualizados = {
      nombre: req.body.nombre,
      definicion: req.body.definicion,
      link_imagen_principal: req.body.link_imagen_principal,
      link_imagen1: req.body.link_imagen1,
      link_imagen2: req.body.link_imagen2,
      link_imagen3: req.body.link_imagen3,
      link_video: req.body.link_video,
      datof: req.body.datof,
      datos: req.body.datos,
      precio: req.body.precio,
      cantidad: req.body.cantidad
  };

  await actualizarArmaDef(armaId, datosActualizados); 
  res.redirect('/homeADMIN');
});
async function actualizarArmaDef(id, datos) {
  try {
      await sql(
          `UPDATE anime
           SET nombre = $1, definicion = $2, link_imagen_principal = $3, link_imagen1 = $4, 
               link_imagen2 = $5, link_imagen3 = $6, link_video = $7, datof = $8, 
               datos = $9, precio = $10, cantidad = $11
                WHERE id = $12`,
          [
              datos.nombre,
              datos.definicion,
              datos.link_imagen_principal,
              datos.link_imagen1,
              datos.link_imagen2,
              datos.link_imagen3,
              datos.link_video,
              datos.datof,
              datos.datos,
              datos.precio,
              datos.cantidad,
              id
          ]
      );
  } catch (error) {
      console.error("Error al actualizar el arma en anime:", error);
      throw error;
  }
}



//------------------------------------------Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

//---------------------------------------------------------------------------carrito = funcional
app.get('/carrito', authMiddleware, async (req, res) => {
  const user = req.user;
  const userId = user.id;

  // Obtener todos los productos del carrito del usuario
  const productosEnCarrito = await sql("SELECT * FROM ventaencaja WHERE id_asignado = $1", [userId]);

  // Crear un objeto para agrupar productos por id_asignado e id_producto
  const productosAgrupados = {};
  const duplicados = [];

  // Detectar duplicados y agrupar productos
  for (const producto of productosEnCarrito) {
    const key = `${producto.id_asignado}-${producto.id_producto}`;

    if (productosAgrupados[key]) {
      // Si ya existe un producto con esta clave, lo marcamos como duplicado
      productosAgrupados[key].cantidad_producto += producto.cantidad_producto;
      productosAgrupados[key].total += producto.total;
      duplicados.push(producto.id); // Guardamos el ID para eliminarlo después
    } else {
      // Agregar el producto si es la primera vez que aparece
      productosAgrupados[key] = { ...producto };
    }
  }

  // Eliminar los productos duplicados (excepto el primero de cada grupo)
  if (duplicados.length > 0) {
    await sql(
      `DELETE FROM ventaencaja WHERE id = ANY($1::int[])`, 
      [duplicados]
    );
  }

  // Actualizar los productos agrupados en la base de datos
  for (const key in productosAgrupados) {
    const producto = productosAgrupados[key];
    await sql(
      `UPDATE ventaencaja 
       SET cantidad_producto = $1, total = $2
       WHERE id = $3`,
      [producto.cantidad_producto, producto.total, producto.id]
    );
  }

  // Calcular el total general después de combinar los productos
  const resultado = await sql("SELECT SUM(total) AS totalin FROM ventaencaja WHERE id_asignado = $1", [userId]);
  const totalin = resultado[0]?.totalin || 0; // Manejar el caso donde no haya total

  // Renderizar la vista con los productos agrupados
  res.render("carrito", { user, carrito: Object.values(productosAgrupados), totalin });
});




app.post('/eliminarcaja', async (req, res) => {
  const cajaId = req.body.id;
  try {
    await eliminarcaja(cajaId);
    console.log(`Producto con ID ${cajaId} eliminado con éxito.`); // Mensaje en consola
    res.redirect('/carrito'); 
  } catch (error) {
    console.error("Error al eliminar el arma:", error);
    res.status(500).send('Ocurrió un error al intentar eliminar el producto.');
  }
});

async function eliminarcaja(id) {
  try {
    await sql(`DELETE FROM ventaencaja WHERE id = $1`, [id]);
    console.log(`Producto con ID ${id} eliminado con éxito. parte 2`); // Mensaje en consola
  } catch (error) {
    console.error("Error la voleta de la base de datos:", error);
    throw error;
  }
}




app.post('/transferir-a-voleta', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const userId = user.id;

    // Obtén la lista de productos en el carrito del usuario
    const productosEnCarrito = await sql("SELECT id_producto, cantidad_producto FROM ventaencaja WHERE id_asignado = $1", [userId]);

    // Verifica si cada producto tiene suficiente cantidad en las tablas producto y productodef
    for (const producto of productosEnCarrito) {
      const { id_producto, cantidad_producto } = producto;

      // Consulta para verificar la cantidad en la tabla producto
      const resultadoProducto = await sql("SELECT cantidad FROM producto WHERE id = $1", [id_producto]);
      const cantidadDisponibleProducto = resultadoProducto.length > 0 ? resultadoProducto[0].cantidad : 0;

      // Consulta para verificar la cantidad en la tabla productodef si no se encuentra en producto
      const resultadoProductoDef = await sql("SELECT cantidad FROM productodef WHERE id = $1", [id_producto]);
      const cantidadDisponibleProductoDef = resultadoProductoDef.length > 0 ? resultadoProductoDef[0].cantidad : 0;

      const cantidadDisponible = Math.max(cantidadDisponibleProducto, cantidadDisponibleProductoDef);

      // Si la cantidad disponible es menor que la cantidad requerida, muestra un error
      if (cantidadDisponible < cantidad_producto) {
        return res.status(400).send(`No se cuenta con suficiente cantidad del producto con ID: ${id_producto}`);
      }
    }

    // Si todas las cantidades son suficientes, procede con la transferencia a voleta
    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${currentDate.getHours().toString().padStart(2, '0')}${currentDate.getMinutes().toString().padStart(2, '0')}${currentDate.getSeconds().toString().padStart(2, '0')}`;

    const n_voleta = `${userId}${formattedDate.replace(/-/g, '')}${formattedTime}`;
    const id_asignado = `${userId}`;

    const transferQuery = `
      INSERT INTO voleta (id_asignado, total, cantidad_producto, n_voleta, id_producto, precio_producto, imagen_producto, nombre_producto, fecha)
      SELECT $1, total, cantidad_producto, $2, id_producto, precio_producto, imagen_producto, nombre_producto, $3
      FROM ventaencaja
      WHERE id_asignado = $4
    `;
    const { totalin } = req.body;
    await sql("UPDATE usuarios SET dinero = dinero - $1 WHERE id = $2", [totalin, userId]);

    await sql(transferQuery, [id_asignado, n_voleta, formattedDate, userId]); // Corrección aquí

    const deleteQuery = `
      DELETE FROM ventaencaja
      WHERE id_asignado = $1
    `;

    await sql(deleteQuery, [userId]);

    res.redirect('/direccionador'); 
  } catch (error) {
    console.error('Error al transferir productos a voleta:', error);
    res.status(500).send('Error al transferir productos a voleta.');
  }
});






//---------------------------------------------------------------------------añadir al carrito = en proceso


app.post('/newcarrito', async (req, res) => {
  try {
    const { id_asignado, id_producto, cantidad_producto, precio_producto, imagen_producto, nombre_producto } = req.body;
    const total = cantidad_producto * precio_producto;

    const query = `
      INSERT INTO ventaencaja 
      (id_asignado, id_producto, cantidad_producto, precio_producto, total, imagen_producto, nombre_producto) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await sql(query, [id_asignado, id_producto, cantidad_producto, precio_producto, total, imagen_producto, nombre_producto]);

    res.redirect('/direccionador');
  } catch (error) {
    console.error('Error al añadir al carrito:', error);
    res.status(500).send('Error al procesar la solicitud');
  }
});