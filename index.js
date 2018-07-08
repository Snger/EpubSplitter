const EPub = require("epub");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require('path');
const htmlParser = require('node-html-parser');

const CONVERT_SINGLE = 'Convert epub to bigger texts';
const CONVERT_BY_CHAPTER = 'Convert epub to text by chapter';
const RENAME_ALL_TEXT_FILES = 'Rename all text files';
const SPLIT_TEXT_FILES = 'Split txts';

const BIG_SIZE = 50000;
const SMALL_SIZE = 5000;

const OUTPUT_BIG_FOLDER = 'big';
const OUTPUT_SMALL_FOLDER = 'small';

const question = [
  {
    type: 'list',
    name: 'task',
    message: 'What do you wanna do?',
    choices: [
      CONVERT_SINGLE,
      CONVERT_BY_CHAPTER,
      RENAME_ALL_TEXT_FILES,
      SPLIT_TEXT_FILES
    ]
  }
];

const askPrompt = async (epubFile) => {
  console.log(epubFile);
  if (!epubFile.endsWith('.epub')) {
    throw new Error('No epub detected');
  }
  const epubFileNameWithoutDotEpub = path.basename(epubFile, '.epub');
  const rootFolder = path.dirname(epubFile);
  
  if (!fs.existsSync(rootFolder + '/' + OUTPUT_BIG_FOLDER)) {
    fs.mkdirSync(rootFolder + '/' + OUTPUT_BIG_FOLDER);
  }
  if (!fs.existsSync(rootFolder + '/' + OUTPUT_SMALL_FOLDER)) {
    fs.mkdirSync(rootFolder + '/' + OUTPUT_SMALL_FOLDER);
  }
  
  const answers = await inquirer.prompt(question);
  
  switch (answers['task']) {
    case CONVERT_SINGLE:
      convertSingle(epubFile, rootFolder, epubFileNameWithoutDotEpub);
      break;
    case CONVERT_BY_CHAPTER:
      convertByChapter(epubFile, rootFolder, epubFileNameWithoutDotEpub);
      break;
    case RENAME_ALL_TEXT_FILES:
      rename(epubFile, rootFolder, epubFileNameWithoutDotEpub);
      break;
    case SPLIT_TEXT_FILES:
      split(rootFolder);
      break;
  }
  askPrompt(epubFile);
}

function convertSingle(epubFile, rootFolder, epubFileNameWithoutDotEpub) {
  const epub = new EPub(epubFile, "/imagewebroot/", "/articlewebroot/");
  epub.on("error", function(err){
    console.log("ERROR\n-----");
    throw err;
  });
  
  epub.on("end", function(err){
    if (err) {
      console.log(err);
      return;
    }
    let text = '';
    let i = 1;
    epub.flow.forEach((chapter, index) => {
      epub.getChapterRaw(chapter.id, function(err, data){
        if(err){
          console.log(err);
          return;
        }
        // 50000 characters
        text += data;
        if (text.length >= BIG_SIZE) {
          fs.writeFile(`${rootFolder}/${OUTPUT_BIG_FOLDER}/${epubFileNameWithoutDotEpub}+${i++}.txt`, text,
            'utf8', (err) => {
              if (err) {
                return console.log(err);
              }
            });
          text = '';
        }
      });
    });
  });
  epub.parse();
}

function convertByChapter(epubFile, rootFolder, epubFileNameWithoutDotEpub) {
  const epub = new EPub(epubFile, "/imagewebroot/", "/articlewebroot/");
  epub.on("error", function(err){
    console.log("ERROR\n-----");
    throw err;
  });
  
  epub.on("end", function(err){
    if (err) {
      console.log(err);
      return;
    }
    epub.flow.forEach((chapter, index) => {
      let i = index;
      if (i < 10) {
        i = '0' + i;
      }
      epub.getChapter(chapter.id, function(err, data){
        if(err){
          console.log(err);
          return;
        }
        // console.log(data.substr(0,512)+"..."); // first 512 bytes
        // 4000 characters
        const htmlNode = htmlParser.parse(data);
        fs.writeFile(`${rootFolder}/${OUTPUT_SMALL_FOLDER}/${epubFileNameWithoutDotEpub}${i}.txt`,
          htmlNode.text, 'utf8', (err) => {
          if (err) {
            return console.log(err);
          }
        });
      });
    });
  });
  epub.parse();
}

function rename(epubFile, rootFolder, epubFileNameWithoutDotEpub) {
  fs.readdirSync(`${rootFolder}/${OUTPUT_SMALL_FOLDER}`).forEach((file, index) => {
    if (file.endsWith('.txt')) {
      var i = index;
      if (i < 10) {
        i = '0' + i;
      }
      fs.renameSync(`${rootFolder}/${OUTPUT_SMALL_FOLDER}/${file}`,
        `${rootFolder}/${OUTPUT_SMALL_FOLDER}/${epubFileNameWithoutDotEpub}${i}.txt`);
    }
  });
}

function split(rootFolder) {
  fs.readdirSync(`${rootFolder}/${OUTPUT_SMALL_FOLDER}`).forEach((file) => {
    if (file.endsWith('.txt')) {
      const content = fs.readFileSync(`${rootFolder}/${OUTPUT_SMALL_FOLDER}/${file}`, 'utf8').toString();
      const fileName = path.basename(file, '.txt');
      let startIndex = 0;
      while (startIndex * SMALL_SIZE <= content.length) {
        const splitted = content.substr(startIndex * SMALL_SIZE, SMALL_SIZE);
        fs.writeFileSync(`${rootFolder}/${OUTPUT_SMALL_FOLDER}/${fileName}+${startIndex}.txt`, splitted);
        startIndex = startIndex + 1;
      }
    }
  });
}

exports.askPrompt = askPrompt;