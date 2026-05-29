# juice_cut

goodbye, paid software. editors, be free.



## HOW TO INSTALL AND USE
go to node.js and install nodejs
in the installer, check all the boxes, especially the one where it says "add nodejs to path" or "add npm to path".
install
done
then open vscode or whatever ide you use
open this project folder.
then open your terminal. it should be a little triangular exclaimation mark on the bottom of your IDE, slightly to the left.
it's like a warning sign ⚠. click that
then make sure in the top tabs, there should be a bunch of shit like "problems" "output" "console" and "terminal"
click on terminal
if you look to the right side bar it should say "powershell". you want cmd. so:
at the top bar of the terminal click the up arrow next to the + icon. then choose cmd
then type npm install
then after it installs, type npm run dev and it should give you a link like http://localhost:5173
paste that in your browser. if it doesn't connect, then go back to your terminal, press ctrl+c to crash the server, then type:
"npm run dev -- --host0.0.0.0"
(without the quotes obv)
and i think it should work
