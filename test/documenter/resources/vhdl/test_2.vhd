--! Copyright 2020 Teros Technology
--!
--! Ismael Perez Rojo
--! Carlos Alberto Ruiz Naranjo
--! Alfredo Saez
--!
--! This file is part of Colibri.
--!
--! Colibri is free software: you can redistribute it and/or modify
--! it under the terms of the GNU General Public License as published by
--! the Free Software Foundation, either version 3 of the License, or
--! (at your option) any later version.
--!
--! Colibri is distributed in the hope that it will be useful,
--! but WITHOUT ANY WARRANTY; without even the implied warranty of
--! MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
--! GNU General Public License for more details.
--!
--! You should have received a copy of the GNU General Public License
--! along with Colibri.  If not, see <https://www.gnu.org/licenses/>.

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

package test is

   -- Types
   type type1 is array(natural range <>) of std_logic_vector(9 downto 0);
   type type2 is array(natural range <>) of std_logic_vector(19 downto 0);
   type type3 is array(natural range <>) of std_logic_vector(29 downto 0);

   type rec_t is record
      rec1 : std_logic_vector(31 downto 0); -- data
      rec2 : std_logic;                     -- data valid
   end record;

   -- Constant
   constant VERSION : natural := 000123;
   constant CONFIG  : string  := "BRAM";

end test;