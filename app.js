import express from 'express';
import { MongoClient } from 'mongodb';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';
import moment from 'moment';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(path.resolve(), 'public')));

let db;

const connectToDatabase = async () => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db('birthday-reminder');
    console.log('Connected to MongoDB');
    scheduleEmails();
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
  }
};

connectToDatabase();

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.OUTLOOK_USER,
    pass: process.env.OUTLOOK_PASS,
  },
});

const sendBirthdayEmail = async (email, name) => {
  const mailOptions = {
    from: process.env.OUTLOOK_USER,
    to: email,
    subject: `Birthday Reminder: ${name}`,
    text: `Tomorrow is ${name}'s birthday! Don't forget to send your wishes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email}`);
  } catch (error) {
    console.error(`Error sending email to ${email}:`, error);
  }
};

// Schedule emails to be sent at 11:50 PM
const scheduleEmails = async () => {
  const now = moment();
  const nextCheck = now.clone().hour(23).minute(50).second(0).millisecond(0);
  if (nextCheck.isBefore(now)) {
    nextCheck.add(1, 'day');
  }

  const delay = nextCheck.diff(now);
  setTimeout(async () => {
    const tomorrow = moment().add(1, 'day');
    const formattedDate = tomorrow.format('YYYY-MM-DD');

    const birthdays = await db
      .collection('birthdays')
      .find({ birthday: formattedDate })
      .toArray();

    birthdays.forEach((birthday) => {
      birthday.notificationEmails.forEach((email) => {
        sendBirthdayEmail(email, birthday.name);
      });
    });

    scheduleEmails();
  }, delay);
};

app.post('/addBirthday', async (req, res) => {
  const { name, birthday, notificationEmails } = req.body;
  const newBirthday = { name, birthday, notificationEmails };
  await db.collection('birthdays').insertOne(newBirthday);
  res.send('Birthday added!');
});

app.post('/addEmailToBirthday', async (req, res) => {
  const { name, additionalEmail } = req.body;
  await db
    .collection('birthdays')
    .updateOne(
      { name },
      { $addToSet: { notificationEmails: additionalEmail } }
    );
  res.send('Email added to birthday!');
});

app.post('/deleteBirthday', async (req, res) => {
  const { name } = req.body;
  await db.collection('birthdays').deleteOne({ name });
  res.send('Birthday deleted!');
});

app.post('/deleteEmailFromBirthday', async (req, res) => {
  const { name, email } = req.body;
  await db
    .collection('birthdays')
    .updateOne({ name }, { $pull: { notificationEmails: email } });
  res.send('Email deleted from birthday!');
});

app.post('/sendTestEmail', async (req, res) => {
  const { email, name } = req.body;

  try {
    await sendBirthdayEmail(email, name);
    res.status(200).send('Test email sent successfully');
  } catch (error) {
    res.status(500).send(`Error sending test email: ${error.message}`);
  }
});

app.get('/getBirthdays', async (req, res) => {
  const birthdays = await db.collection('birthdays').find().toArray();
  res.json(birthdays);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
