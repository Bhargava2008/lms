// migrateBooksFromExcel.js
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");

// ✅ MongoDB Atlas Connection
const MONGODB_URI =
  "mongodb+srv://EduLibraryAdmin:EduLibraryAdminPWD@cluster0.zidoavt.mongodb.net/EduLibraryDB?retryWrites=true&w=majority&appName=Cluster0";

// ✅ Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// ✅ Define Book Schema
const bookSchema = new mongoose.Schema({
  bookName: String,
  authorName: String,
  isbn: String,
  department: String,
  status: { type: String, default: "available" },
});

const BookModel = mongoose.model("Book", bookSchema);

// ✅ Read Excel File Function
const readExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  return sheetData;
};

// ✅ Migration Function
const migrateBooks = async () => {
  try {
    const filePath = path.join(__dirname, "BOOKS LIST IN LIBRARY.xlsx");
    const excelData = readExcelFile(filePath);

    console.log("🔄 ========== BOOKS MIGRATION START ==========");
    console.log(`📊 Total entries in Excel: ${excelData.length}`);

    // Transform Excel rows into book objects
    const booksData = excelData
      .map((row) => ({
        bookName: row["book Name"]?.trim(),
        authorName: row["author Name"]?.trim(),
        isbn: row["isbn"]?.trim(),
        department: row["department"]?.trim(),
        status: "available",
      }))
      .filter((b) => b.bookName && b.authorName && b.isbn && b.department);

    console.log(`📚 Valid entries to insert: ${booksData.length}`);

    // Optional: Clear existing books
    console.log("\n🗑️ Clearing existing books...");
    const deleteResult = await BookModel.deleteMany({});
    console.log(`✅ Books deleted: ${deleteResult.deletedCount}`);

    // Insert new ones
    console.log("\n📥 Inserting new books...");
    const insertResult = await BookModel.insertMany(booksData);
    console.log(`✅ Books inserted: ${insertResult.length}`);

    // Summary
    const totalBooks = await BookModel.countDocuments();
    console.log("\n📊 MIGRATION SUMMARY:");
    console.log(`   📚 Total books in DB: ${totalBooks}`);
    console.log(`   ✅ Default status: "available"`);

    console.log("\n📖 SAMPLE IMPORTED BOOKS:");
    insertResult.slice(0, 10).forEach((book) => {
      console.log(`   ${book.isbn}: ${book.bookName} - ${book.authorName}`);
    });

    console.log("\n🎉 SUCCESS: Books migration completed!");
  } catch (error) {
    console.error("❌ Error during migration:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ MongoDB connection closed");
    console.log("🔄 ========== BOOKS MIGRATION END ==========");
  }
};

// ✅ Run the script
const runScript = async () => {
  console.log("🚀 Starting Books Migration Script...");
  await connectDB();
  await migrateBooks();
  process.exit(0);
};

runScript();
