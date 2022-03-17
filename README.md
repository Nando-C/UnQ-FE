<div id="top"></div>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <!-- <a href="https://github.com/Nando-C/UnQ-FE">
    <img src="linkedin/public/linkedIn-logo.png" alt="Logo" height="100">
  </a> -->

<h3 align="center">UnQ -> [Front-End]</h3>

  <p align="center">
    A Food & Drinks Ordering Application, solo capstone project developed for Strive School's Full Stack program!
    <br />
    <br />
    <a href="https://un-q.vercel.app/">View Demo</a>
    <!-- ·
    <a href="https://github.com/Nando-C/UnQ-FE/issues">Report Bug</a> -->
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a>
     <ul>
        <li><a href="#posts">Posts</a></li>
        <li><a href="#profile">Profile</a></li>
        <li><a href="#downloads">Downloads</a></li>
      </ul>
    </li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

<!-- [![Product Name Screen Shot][product-screenshot]](https://example.com) -->

This is the Front-End of my Solo Capstone project for the Full Stack Master Camp at Strive School.

Developed completly from (not having idea of what to conceive) concept to deployment in 5 weeks, implementing both the Font-End & Back-End from scratch within this time frame.

In reality this is a MVP (Minimal Viable Product) that I am planning to improve in the near future, but still makes me really proud! 😁

You can find the Back-End repo of this project in the following link: [UnQ's BackEnd](https://github.com/Nando-C/UnQ-BE)

<p align="right">(<a href="#top">back to top</a>)</p>

### Built With

- [TypeScript](https://typescriptlang.org/)
- [Node.js](https://nodejs.org/)
- [React.js](https://reactjs.org/)
- [Bootstrap](https://getbootstrap.com)
- [Redux](https://redux.js.org/)
- Love ❤️ and lots of coffee ☕️

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## App Use

The main idea behind this application is to provide the venue with a unique QR-code per table or Point Of Service/POS (which is generated automagically by the app), So when the customer wants to place an order, simply scan the QR code selct the items and pay.

So for this purpose, the app has two user interfaces:

- Customer

  Used by the customers to order and pay for Food & Drinks and designed to be only mobile.

  <img src="public/UnQ-Customer.png" alt="UnQ-customer">

- Venue / Shop

  Used by the venue's/shop's staff to create and edit the place profile, i.e contact details, modify the menu, create table/POS QR-codes (and in the next version, get some sales analisis).

  <img src="public/UnQ-Venue.png" alt="UnQ-venue">

<p align="right">(<a href="#top">back to top</a>)</p>

### Customer

- Ideally you will land here by having scaned a venue's QR-code on your mobile, which places you right in the specific table/POS your are within the venue/shop. You will see the venue's availble menu and can start adding items to the cart.

    <img src="public/UnQ-Customer.png" alt="UnQ-customer">

- In case you land here on a different route, you will have a list of venues to choose from. Then you'll have to first select the table/POS you are, before being able to add items to the cart.

    <img src="public/customer-no-qrcode.gif" alt="customer-no-qrcode">

- On the cart, you have the option to select all items and pay for the full bill or select the quantities of the ones you want to pay for, to share the bill with your friends. In the second case, your friends can scan the QRcode with their phones to select the remaining items, or use the same phone to do so and pay with their own card.

    <img src="public/cart-selection.gif" alt="cart-items-selection">

- As for payment options, you can use your paypal account or your prefered Debit or Credit Card.

    <img src="public/payment.gif" alt="payment-options">

  You can test payments using the following paypal demo account details:

        user: sb-earpx8110921@personal.example.com
        password: 7--vsMqt

<p align="right">(<a href="#top">back to top</a>)</p>

### Venue

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

[@Nando](https://hernando-crespo.vercel.app/) - Get in touch and let me know what do you think of this project! 😉

<p align="right">(<a href="#top">back to top</a>)</p>

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
