const mysql = require("../databases/mysql");

module.exports = {
  async create(req, res) {
    try {
      const connection = await mysql;
      const { products } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "Lista de produtos inválida" });
      }

      // Inicia uma transação
      await connection.beginTransaction();

      for (const product of products) {
        // Verifica se o produto existe e tem estoque suficiente
        const [existing] = await connection.query(
          `SELECT units FROM products WHERE id = ?`,
          [product.id]
        );

        if (!existing || existing[0].units < product.units) {
          await connection.rollback();
          return res.status(400).json({
            message: `Estoque insuficiente para o produto com ID ${product.id}`,
          });
        }

        // Atualiza o estoque do produto
        await connection.query(
          `UPDATE products SET units = units - ? WHERE id = ?`,
          [product.units, product.id]
        );
      }

      // Prepara os dados para inserir na tabela purchases
      const purchaseData = products.map((product) => [
        product.id,
        1, // Exemplo de user_id; altere conforme necessário
        product.units,
      ]);

      await connection.query(
        `INSERT INTO purchases (product_id, user_id, units) VALUES ?`,
        [purchaseData]
      );

      // Finaliza a transação
      await connection.commit();

      return res.status(200).json({ message: "Compra finalizada com sucesso" });
    } catch (e) {
      console.error(e);

      // Reverte a transação em caso de erro
      if (connection) {
        await connection.rollback();
      }

      return res.status(500).json({ message: "Erro ao processar a compra" });
    }
  },
};
