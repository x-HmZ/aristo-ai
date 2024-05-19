"use client"
import React from 'react'
import { LampContainer } from './ui/lamp'
import { PlaceholdersAndVanishInput } from './ui/placeholders-and-vanish-input'

const arr = [
  "Hello",
  "World",
  "How",
  "Are",
  "You",
]

function Hero() {
  return (
    <>
      <div className="">
        <div>
          <LampContainer>Aristo</LampContainer>
          <PlaceholdersAndVanishInput placeholders={arr} />
        </div>
      </div>
    </>
  )
}

export default Hero
