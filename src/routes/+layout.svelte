<head>
  <title>My Blog</title>
  <link rel="stylesheet" href="/style.css" />
</head>

<header>
  <div class="topnav">
    <a class="title" href="/">{"{"}{"{"} BinayakD {"}"}{"}"}</a>
    <div class="topnav-right">
      <a href="#search" target="_blank">About</a>
      <a href="https://github.com/binayakd" target="_blank">Github</a>
    </div>
  </div>
</header>

<div class="nav-separator" />

<main>
  <slot />
</main>

<div class="nav-separator" />

<footer>
  <p>&copy; 2023 My Blog</p>
</footer>

<style>
  .topnav {
    overflow: hidden;
    padding-top: 20px;
    padding-bottom: 20px;
    padding-right: 5px;
    padding-left: 5px;
    /* margin-top: 20px; */
    /* background-color: #333; */
  }

  .topnav a {
    float: left;
    color: #00ff00;
    text-align: center;
    padding: 14px 16px;
    text-decoration: none;
    font-size: 17px;
    text-shadow: none;
    transition: all 0.5s ease-in-out;
  }

  .topnav a:hover {
    /* background-color: #ddd;
  color: black; */
    text-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 15px #00ff00,
      0 0 20px #00ff00, 0 0 35px #00ff00, 0 0 40px #00ff00, 0 0 50px #00ff00,
      0 0 75px #00ff00;
    transition: all 0.5s ease-in-out;
  }

  .topnav-right {
    float: right;
  }
  
  a.title {
    font-size: 25px;
  }
</style>
